import { test, expect } from "@playwright/test";

test("login supports English and Hindi before authentication", async ({ page }) => {
  await page.route("**/v1/api/anchal/session", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "UNAUTHENTICATED", message: "Sign in required" },
    }),
  );
  await page.goto("/anchal/");
  await expect(
    page.getByRole("heading", { name: "Office sign in", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByLabel("उपयोगकर्ता नाम", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
});
