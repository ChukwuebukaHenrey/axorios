export type SyncProduct = {
  id: string;
  /** Stable for this product, so a retry that lost the saved ID still updates instead of duplicating. */
  handle: string;
  name: string;
  description: string;
  /** Already converted to the shop's currency, as a decimal string. */
  price: string;
  stock: number;
  imageUrl: string | null;
};

export type SyncPage = { key: string; title: string; bodyHtml: string };

export type ExternalIds = {
  products: Record<string, string>;
  collection?: string;
  pages: Record<string, string>;
};

export type ThemeHandoff = {
  /** Shopify needs a special exemption to write theme files, so the seller applies these in its theme editor. */
  editorUrl: string;
  palette: Record<string, string>;
  fonts: { heading: string; body: string };
};

export type AccessGrant = { token: string; expiresAt: string; scopes: string[] };

export type ShopInfo = { name: string; currency: string; storefrontUrl: string };

export type ShopAccess = { token: string; shopDomain: string };

export interface CommercePlatform {
  name: "shopify";
  /** Asks the platform for an access token, which also tests the connection. */
  connect(shopDomain: string): Promise<AccessGrant>;
  shopInfo(access: ShopAccess): Promise<ShopInfo>;
  syncProducts(access: ShopAccess, products: SyncProduct[], known: Record<string, string>): Promise<Record<string, string>>;
  syncCollection(access: ShopAccess, title: string, knownId: string | undefined, productIds: string[]): Promise<string>;
  syncPages(access: ShopAccess, pages: SyncPage[], known: Record<string, string>): Promise<Record<string, string>>;
  themeHandoff(access: ShopAccess, brand: Pick<ThemeHandoff, "palette" | "fonts">): Promise<ThemeHandoff>;
}
