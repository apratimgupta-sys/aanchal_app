import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const vercelConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
) as {
  rewrites: Array<{ source: string; destination: string }>;
};

describe("Vercel subpath deployment", () => {
  it("serves Vite bundles requested from the /anchal base path", () => {
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/anchal/assets/:path*",
      destination: "/assets/:path*",
    });
  });

  it("proxies Anchal API requests to the staging backend host", () => {
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/v1/api/anchal/:path*",
      destination: "https://anchal-backend-staging.onrender.com/v1/api/anchal/:path*",
    });
  });
});
