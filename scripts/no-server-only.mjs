// Preload for scripts that import server modules directly: `server-only` throws outside Next's server bundle,
// so resolve it to an empty module here. Scripts run on the server anyway.
// Use: npx tsx --import ./scripts/no-server-only.mjs ...
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: new URL("../node_modules/server-only/empty.js", import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
});
