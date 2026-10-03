import { test, expect } from "@playwright/test";
import { todayIST } from "../../src/domain/ledger";
const password = "Rmc-Demo-2026!";
async function login(page: any, user: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
test("bilingual login", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Office sign in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByLabel("उपयोगकर्ता नाम")).toBeVisible();
  await page.screenshot({
    path: "test-results/login-hindi.png",
    fullPage: true,
  });
});
test("office submission, live dashboard, correction and history", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const office = await a.newPage(),
    commissioner = await b.newPage();
  await login(office, "anchal1");
  await expect(office.getByRole("heading").first()).toBeVisible();
  if (
    await office
      .getByRole("heading", { name: "Set opening balances", exact: true })
      .isVisible()
  ) {
    await office.getByLabel("Reporting start date").fill("2026-10-01");
    await office.getByLabel("1 service", { exact: true }).fill("10");
    await office.getByLabel("1 complaints", { exact: true }).fill("3");
    await office.getByLabel("1 field", { exact: true }).fill("5");
    await office
      .getByLabel("I confirm all opening balances, including zero balances.")
      .check();
    await office
      .getByRole("button", { name: "Save opening balances", exact: true })
      .click();
  }
  await expect(
    office.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await login(commissioner, "commissioner");
  await expect(
    commissioner.getByRole("heading", { name: "Office monitoring dashboard" }),
  ).toBeVisible();
  await expect(
    commissioner.getByText("Connected", { exact: false }).first(),
  ).toBeVisible();
  await office
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await office.getByLabel("Ward number / name").fill("Ward 1");
  await office.getByLabel("Received / Transactions", { exact: true }).fill("5");
  await office.getByLabel("Disposed / Completed", { exact: true }).fill("2");
  await office.getByLabel("SLA Within Time", { exact: true }).fill("2");
  await office.getByLabel("Avg Disposal Days", { exact: true }).fill("1.5");
  await office
    .getByLabel("Amount Collected (₹)", { exact: true })
    .fill("101.25");
  const correction = await office
    .getByLabel("Correction reason", { exact: true })
    .isVisible();
  if (correction)
    await office.getByLabel("Correction reason").fill("Browser verification");
  const start = Date.now();
  await office
    .getByRole("button", {
      name: correction ? "Save correction →" : "Submit entry →",
      exact: true,
    })
    .click();
  await expect(office.getByRole("status")).toContainText("Entry saved");
  const row = commissioner
    .locator("tbody tr")
    .filter({ hasText: "Anchal 1" })
    .first();
  await expect(row).toContainText("₹101.25", { timeout: 2000 });
  expect(Date.now() - start).toBeLessThan(2000);
  await office.getByLabel("Received / Transactions", { exact: true }).fill("6");
  await office
    .getByLabel("Correction reason", { exact: true })
    .fill("Corrected receipt count");
  await office
    .getByRole("button", { name: "Save correction →", exact: true })
    .click();
  await expect(office.getByRole("status")).toContainText("Entry saved");
  await expect(row.locator("td").nth(1)).toHaveText("6", { timeout: 2000 });
  await b.setOffline(true);
  await office.getByLabel("Received / Transactions", { exact: true }).fill("7");
  await office
    .getByLabel("Correction reason", { exact: true })
    .fill("Reconnect test");
  await office
    .getByRole("button", { name: "Save correction →", exact: true })
    .click();
  await expect(office.getByRole("status")).toContainText("Entry saved");
  await b.setOffline(false);
  await expect(row.locator("td").nth(1)).toHaveText("7", { timeout: 20000 });
  await commissioner.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await commissioner
    .getByRole("button", { name: "Change history", exact: true })
    .click();
  await expect(
    commissioner.getByText("Corrected receipt count", { exact: true }).first(),
  ).toBeVisible();
  await office.setViewportSize({ width: 390, height: 844 });
  await office.screenshot({
    path: "test-results/office-mobile.png",
    fullPage: true,
  });
  await a.close();
  await b.close();
});
test("monthly view includes the full month and refresh preserves the entry register", async ({
  page,
}) => {
  await login(page, "commissioner");
  await page.getByLabel("View", { exact: false }).first().selectOption("month");
  await expect(
    page.getByText(todayIST().slice(0, 7) + "-01 — " + todayIST(), {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View service entries and remarks →",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Service entry register" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Service entry register" }),
  ).toBeVisible();
});
test("new service requires deliberate counts or zero activity", async ({
  page,
}) => {
  await login(page, "anchal1");
  await expect(
    page.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "02 Holding tax payment", exact: false })
    .click();
  await expect(
    page.getByLabel("Received / Transactions", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await expect(
    page.getByLabel("Received / Transactions", { exact: true }),
  ).toHaveValue("0");
});
