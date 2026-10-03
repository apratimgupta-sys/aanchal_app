import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        compatibilityDate: "2026-08-22",
        bindings: {
          TEST_SCHEMA: readFileSync("./migrations/0001_initial.sql", "utf8"),
        },
      },
    }),
  ],
  test: { include: ["tests/worker/**/*.test.ts"] },
});
