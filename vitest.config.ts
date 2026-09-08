import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: {
      "@ginmap/config": resolve(root, "packages/config/src/index.ts"),
      "@ginmap/model": resolve(root, "packages/model/src/index.ts"),
      "@ginmap/db": resolve(root, "packages/db/src/index.ts"),
      "@ginmap/github": resolve(root, "packages/github/src/index.ts"),
      "@ginmap/analytics": resolve(root, "packages/analytics/src/index.ts"),
      "@ginmap/render": resolve(root, "packages/render/src/index.ts")
    }
  }
});
