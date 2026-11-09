/** Workspace pages a context chip can name. Pure, so the browser shell and the agent share it. */
export const PAGE_KEYS = ["home", "ai", "store", "orders", "customers", "inbox", "marketing", "money", "analytics", "design", "settings"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
