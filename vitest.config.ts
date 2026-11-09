import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same `@/` alias as tsconfig, so a test can load a module that imports through it.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Images/ holds design references (including a third-party toolkit with its own test runner),
    // not project source. Vitest's default glob would otherwise pick its *.test.mjs files up too.
    exclude: ["**/node_modules/**", "**/Images/**"],
  },
});
