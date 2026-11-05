import "server-only";
import { createAdminApiClient } from "@shopify/admin-api-client";
import { NonRetriableError } from "inngest";
import { env } from "@/lib/env";
import { escapeHtml } from "../content";
import type { AccessGrant, CommercePlatform, ShopAccess, SyncPage, SyncProduct } from "../types";

const API_VERSION = "2026-10";

type UserError = { field?: string[] | null; message: string };

/** One GraphQL call. Errors carry Shopify's message, never the token. */
async function graph<T>({ token, shopDomain }: ShopAccess, query: string, variables?: Record<string, unknown>): Promise<T> {
  const client = createAdminApiClient({ storeDomain: shopDomain, apiVersion: API_VERSION, accessToken: token });
  const { data, errors } = await client.request<T>(query, { variables });
  if (errors || !data) {
    const reason = errors?.graphQLErrors?.map((e) => e.message).join("; ") ?? errors?.message ?? "no data";
    throw new Error(`Shopify request failed: ${reason}`);
  }
  return data;
}

function assertNoUserErrors(action: string, errors: UserError[]): void {
  // Shopify refusing the input is not going to change on a retry.
  if (errors.length > 0) throw new NonRetriableError(`Shopify ${action} refused: ${errors.map((e) => e.message).join("; ")}`);
}

async function primaryLocation(access: ShopAccess): Promise<string | null> {
  const { locations } = await graph<{ locations: { nodes: { id: string }[] } }>(access, `{ locations(first: 1) { nodes { id } } }`);
  return locations.nodes[0]?.id ?? null;
}

async function setProduct(access: ShopAccess, product: SyncProduct, knownId: string | undefined, locationId: string | null): Promise<string> {
  const { productSet } = await graph<{ productSet: { product: { id: string } | null; userErrors: UserError[] } }>(
    access,
    `mutation SetProduct($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product { id }
        userErrors { field message }
      }
    }`,
    {
      identifier: knownId ? { id: knownId } : { handle: product.handle },
      input: {
        title: product.name,
        handle: product.handle,
        descriptionHtml: `<p>${escapeHtml(product.description)}</p>`,
        status: "ACTIVE",
        productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
        variants: [
          {
            optionValues: [{ optionName: "Title", name: "Default Title" }],
            price: product.price,
            inventoryItem: { tracked: true },
            ...(locationId && { inventoryQuantities: [{ locationId, name: "available", quantity: product.stock }] }),
          },
        ],
        ...(product.imageUrl && { files: [{ originalSource: product.imageUrl, contentType: "IMAGE" }] }),
      },
    },
  );
  assertNoUserErrors("product sync", productSet.userErrors);
  if (!productSet.product) throw new Error("Shopify returned no product");
  return productSet.product.id;
}

async function setPage(access: ShopAccess, page: SyncPage, knownId: string | undefined): Promise<string> {
  const input = { title: page.title, body: page.bodyHtml, isPublished: true };
  if (knownId) {
    const { pageUpdate } = await graph<{ pageUpdate: { userErrors: UserError[] } }>(
      access,
      `mutation UpdatePage($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { userErrors { field message } } }`,
      { id: knownId, page: input },
    );
    assertNoUserErrors("page update", pageUpdate.userErrors);
    return knownId;
  }
  const { pageCreate } = await graph<{ pageCreate: { page: { id: string } | null; userErrors: UserError[] } }>(
    access,
    `mutation CreatePage($page: PageCreateInput!) { pageCreate(page: $page) { page { id } userErrors { field message } } }`,
    { page: input },
  );
  assertNoUserErrors("page create", pageCreate.userErrors);
  if (!pageCreate.page) throw new Error("Shopify returned no page");
  return pageCreate.page.id;
}

export const shopify: CommercePlatform = {
  name: "shopify",

  /** The client-credentials grant, which only works on this app's own development store. */
  async connect(shopDomain): Promise<AccessGrant> {
    const e = env();
    if (!e.SHOPIFY_CLIENT_ID || !e.SHOPIFY_CLIENT_SECRET) throw new NonRetriableError("Shopify is not configured");
    const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: e.SHOPIFY_CLIENT_ID, client_secret: e.SHOPIFY_CLIENT_SECRET }),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; scope?: string; error?: string } | null;
    if (!res.ok || !body?.access_token) throw new Error(`Shopify connect failed: HTTP ${res.status} ${body?.error ?? ""}`.trim());
    return {
      token: body.access_token,
      expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
      scopes: (body.scope ?? "").split(",").filter(Boolean),
    };
  },

  async shopInfo(access) {
    const { shop } = await graph<{ shop: { name: string; currencyCode: string; url: string } }>(access, `{ shop { name currencyCode url } }`);
    return { name: shop.name, currency: shop.currencyCode, storefrontUrl: shop.url };
  },

  async syncProducts(access, products, known) {
    const locationId = await primaryLocation(access);
    const ids: Record<string, string> = {};
    for (const product of products) ids[product.id] = await setProduct(access, product, known[product.id], locationId);
    return ids;
  },

  async syncCollection(access, title, knownId, productIds) {
    let id = knownId;
    if (id) {
      const { collectionUpdate } = await graph<{ collectionUpdate: { userErrors: UserError[] } }>(
        access,
        `mutation UpdateCollection($input: CollectionInput!) { collectionUpdate(input: $input) { userErrors { field message } } }`,
        { input: { id, title } },
      );
      assertNoUserErrors("collection update", collectionUpdate.userErrors);
    } else {
      const { collectionCreate } = await graph<{ collectionCreate: { collection: { id: string } | null; userErrors: UserError[] } }>(
        access,
        `mutation CreateCollection($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }`,
        { input: { title } },
      );
      assertNoUserErrors("collection create", collectionCreate.userErrors);
      id = collectionCreate.collection?.id;
      if (!id) throw new Error("Shopify returned no collection");
    }

    // collectionAddProducts refuses a product that's already in, so add only the new ones.
    const { collection } = await graph<{ collection: { products: { nodes: { id: string }[] } } | null }>(
      access,
      `query Members($id: ID!) { collection(id: $id) { products(first: 250) { nodes { id } } } }`,
      { id },
    );
    const inside = new Set(collection?.products.nodes.map((p) => p.id));
    const missing = productIds.filter((p) => !inside.has(p));
    if (missing.length > 0) {
      const { collectionAddProducts } = await graph<{ collectionAddProducts: { userErrors: UserError[] } }>(
        access,
        `mutation AddProducts($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`,
        { id, productIds: missing },
      );
      assertNoUserErrors("collection products", collectionAddProducts.userErrors);
    }
    return id;
  },

  async syncPages(access, pages, known) {
    const ids: Record<string, string> = {};
    for (const page of pages) ids[page.key] = await setPage(access, page, known[page.key]);
    return ids;
  },

  async themeHandoff(access, { palette, fonts }) {
    const { themes } = await graph<{ themes: { nodes: { id: string }[] } }>(access, `{ themes(first: 1, roles: [MAIN]) { nodes { id } } }`);
    const handle = access.shopDomain.replace(/\.myshopify\.com$/, "");
    const themeId = themes.nodes[0]?.id.split("/").pop();
    return {
      editorUrl: `https://admin.shopify.com/store/${handle}/themes${themeId ? `/${themeId}/editor` : ""}`,
      palette,
      fonts,
    };
  },
};
