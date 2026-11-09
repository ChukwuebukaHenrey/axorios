import "server-only";
import { env } from "@/lib/env";
import { cloudflareFluxImages } from "./adapters/cloudflare-flux";
import { templateImages } from "./adapters/template";
import type { ImageProvider } from "./types";

/** Adding a vendor means one adapter file, one entry here, and one value on the IMAGE_PROVIDER env schema. */
const providers: Record<ReturnType<typeof env>["IMAGE_PROVIDER"], ImageProvider> = {
  template: templateImages,
  "cloudflare-flux": cloudflareFluxImages,
};

export function imageProvider(): ImageProvider {
  return providers[env().IMAGE_PROVIDER];
}
