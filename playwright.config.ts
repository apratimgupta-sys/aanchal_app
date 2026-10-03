import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: {
    baseURL: process.env.RMC_TEST_URL ?? "http://127.0.0.1:8787",
    browserName: "chromium",
  },
  workers: 1,
  timeout: 60000,
});
