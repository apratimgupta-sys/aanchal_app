import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const credentials: Record<string, string> | null = process.env
  .RMC_CREDENTIALS_FILE
  ? JSON.parse(readFileSync(process.env.RMC_CREDENTIALS_FILE, "utf8"))
  : null;
async function signIn(page: import("@playwright/test").Page, user: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page
    .getByLabel("Password", { exact: true })
    .fill(credentials?.[user] ?? "Rmc-Demo-2026!");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
async function setTheme(page: import("@playwright/test").Page, theme: string) {
  await page.evaluate(async (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    // Flush styles, then wait for UX4G's colour transitions before scanning.
    document.body.getBoundingClientRect();
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  }, theme);
}
async function accessible(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
async function touchTargets(page: import("@playwright/test").Page) {
  const undersized = await page
    .locator(
      "button:not(:disabled), .ux4g-input, select, textarea, summary, .ux4g-checkbox",
    )
    .evaluateAll((elements) =>
      elements
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        })
        .map((el) => ({
          tag: el.tagName,
          name: el.textContent?.trim(),
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
    );
  expect(undersized).toEqual([]);
}
async function noPageOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("UX4G login: keyboard access, light/dark contrast and four responsive modes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByLabel("Username", { exact: true }).focus();
  expect(
    await page
      .locator(".ux4g-input")
      .first()
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (const width of [390, 1100, 1500, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await noPageOverflow(page);
    await touchTargets(page);
    for (const theme of ["light", "dark"]) {
      await setTheme(page, theme);
      await accessible(page);
      await page.screenshot({
        path: `test-results/ux4g-login-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
test("UX4G dashboard and entry: responsive tables, labelled controls and colour contrast", async ({
  page,
}) => {
  await signIn(page, "commissioner");
  await expect(
    page.getByRole("heading", { name: "Anchal-wise performance" }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await setTheme(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await noPageOverflow(page);
    await touchTargets(page);
    await accessible(page);
    await page.screenshot({
      path: `test-results/ux4g-dashboard-${theme}-mobile.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, process.env.RMC_TEST_URL ? "anchal6" : "anchal1");
  await expect(
    page.getByRole("heading", { name: "Daily service entry", exact: true }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await setTheme(page, theme);
    await noPageOverflow(page);
    await touchTargets(page);
    await accessible(page);
  }
});

test("canceling a service switch preserves both the draft and selected service", async ({
  page,
}) => {
  await signIn(page, process.env.RMC_TEST_URL ? "anchal6" : "anchal1");
  await expect(
    page.getByLabel("Ward number / name", { exact: true }),
  ).toBeVisible();
  const rows = page.locator(".service-list button");
  await page
    .getByLabel("Ward number / name", { exact: true })
    .fill("Unsaved ward draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await rows.nth(1).click();
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(rows.nth(1)).not.toHaveClass(/\bactive\b/);
  await expect(
    page.getByLabel("Ward number / name", { exact: true }),
  ).toHaveValue("Unsaved ward draft");
  page.once("dialog", (dialog) => dialog.accept());
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
});
