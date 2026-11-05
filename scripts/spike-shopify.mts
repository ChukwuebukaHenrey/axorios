// Spike 0.5: client-credentials grant, productSet creates a product, themeFilesUpsert changes a colour.
// Run: npx tsx --env-file=.env.local scripts/spike-shopify.mts
// Safe to repeat: the product is found by handle, and the theme colour is put back after it is read.
const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = "2026-10";
const SETTINGS_FILE = "config/settings_data.json";

async function connectFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (attempt === 4) throw error;
      console.log(`  network error, retrying (${attempt})`);
    }
  }
}

const grant = await connectFetch(`https://${domain}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
  }),
});
const granted = (await grant.json()) as { access_token?: string; scope?: string; expires_in?: number };
if (!granted.access_token) throw new Error(`Grant failed: HTTP ${grant.status}`);
console.log(`grant: OK, expires in ${granted.expires_in}s`);
console.log(`scopes: ${granted.scope}`);

type GraphResult = { data?: any; errors?: { message: string; extensions?: unknown }[] };
async function graphql(query: string, variables: Record<string, unknown> = {}): Promise<GraphResult> {
  const res = await connectFetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": granted.access_token! },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  return (await res.json()) as GraphResult;
}

// 1. productSet
const product = await graphql(
  `mutation Spike($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
    productSet(identifier: $identifier, input: $input, synchronous: true) {
      product { id title handle status variants(first: 1) { nodes { price } } }
      userErrors { field message code }
    }
  }`,
  {
    identifier: { handle: "axorios-spike-cake" },
    input: {
      title: "AxoriOS spike cake",
      handle: "axorios-spike-cake",
      status: "DRAFT",
      descriptionHtml: "<p>Created by scripts/spike-shopify.mts</p>",
      productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
      variants: [{ optionValues: [{ optionName: "Title", name: "Default Title" }], price: "45000.00" }],
    },
  },
);
console.log("productSet:", JSON.stringify(product.errors ?? product.data?.productSet, null, 1));
if (product.errors || product.data?.productSet?.userErrors?.length) process.exitCode = 1;

// 2. Read the live theme's settings
const themes = await graphql(`{
  themes(first: 1, roles: [MAIN]) { nodes { id name role } }
}`);
const theme = themes.data?.themes?.nodes?.[0];
console.log("main theme:", themes.errors ? JSON.stringify(themes.errors) : theme?.name);
if (!theme) throw new Error("No main theme to test");

const read = await graphql(
  `query Files($id: ID!, $names: [String!]!) {
    theme(id: $id) { files(filenames: $names, first: 1) { nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } }
  }`,
  { id: theme.id, names: [SETTINGS_FILE] },
);
const original: string | undefined = read.data?.theme?.files?.nodes?.[0]?.body?.content;
console.log("theme read:", read.errors ? JSON.stringify(read.errors) : `${original?.length ?? 0} chars`);
if (!original) throw new Error("Could not read theme settings");

// 3. Change the first hex colour and write it back
const hexMatch = original.match(/"#[0-9a-fA-F]{6}"/);
if (!hexMatch) throw new Error("No hex colour found in settings_data.json");
const NEW_COLOUR = '"#7A1F3D"';
const changed = original.replace(hexMatch[0], hexMatch[0].toLowerCase() === NEW_COLOUR.toLowerCase() ? '"#7A1F3E"' : NEW_COLOUR);

const UPSERT = `mutation Upsert($id: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $id, files: $files) {
    upsertedThemeFiles { filename }
    userErrors { field message code }
  }
}`;
const write = (content: string) =>
  graphql(UPSERT, { id: theme.id, files: [{ filename: SETTINGS_FILE, body: { type: "TEXT", value: content } }] });

const upsert = await write(changed);
console.log("themeFilesUpsert:", JSON.stringify(upsert.errors ?? upsert.data?.themeFilesUpsert, null, 1));

const wrote = !upsert.errors && !upsert.data?.themeFilesUpsert?.userErrors?.length;
if (!wrote) {
  console.log("THEME WRITE: REFUSED");
} else {
  const back = await graphql(
    `query Files($id: ID!, $names: [String!]!) {
      theme(id: $id) { files(filenames: $names, first: 1) { nodes { body { ... on OnlineStoreThemeFileBodyText { content } } } } }
    }`,
    { id: theme.id, names: [SETTINGS_FILE] },
  );
  const stored: string | undefined = back.data?.theme?.files?.nodes?.[0]?.body?.content;
  const applied = stored?.includes(NEW_COLOUR) || stored?.includes('"#7A1F3E"');
  console.log(`THEME WRITE: ${applied ? "ACCEPTED and read back" : "ACCEPTED but not seen on read"} (${hexMatch[0]} changed)`);
  const restore = await write(original);
  console.log("restored original settings:", !restore.errors && !restore.data?.themeFilesUpsert?.userErrors?.length);
}
