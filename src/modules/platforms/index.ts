export { isShopDomain, pagesFromStore, productHandle } from "./content";
export {
  activeProductCount,
  connectShop,
  finishSync,
  PlatformError,
  productStepCount,
  queueSync,
  recordSyncFailure,
  shopConnection,
  syncProductBatch,
} from "./service";
export type { SyncResult } from "./service";
export type { CommercePlatform, ThemeHandoff } from "./types";
