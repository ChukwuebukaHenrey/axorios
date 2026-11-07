import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Images/ holds design references (including a third-party toolkit with its own test runner),
    // not project source. Vitest's default glob would otherwise pick its *.test.mjs files up too.
    exclude: ["**/node_modules/**", "**/Images/**"],
  },
});
