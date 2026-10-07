import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { todayIST } from "../../src/domain/ledger";
const credentials: Record<string, string> | null = process.env
  .RMC_CREDENTIALS_FILE
  ? JSON.parse(readFileSync(process.env.RMC_CREDENTIALS_FILE, "utf8"))
  : null;
const password = process.env.RMC_TEST_PASSWORD ?? "Rmc-Demo-2026!";
const testOfficeId = Number(
  process.env.RMC_TEST_OFFICE ?? (process.env.RMC_TEST_URL ? 6 : 1),
);
const testOfficeAccount = `anchal${testOfficeId}`;
const localSetupFixture =
  process.env.RMC_TEST_LOCAL === "1" &&
  !!process.env.RMC_TEST_URL &&
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.RMC_TEST_URL).hostname,
  );
async function login(page: any, user: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page
    .getByLabel("Password", { exact: true })
    .fill(credentials?.[user] ?? password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  if (user.startsWith("anchal")) {
    if (
      await page
        .getByRole("heading", { name: "Set opening balances", exact: true })
        .isVisible()
    ) {
      if (!localSetupFixture)
        test.skip(
          true,
          "Office setup is absent; baseline writes are disabled outside the explicit local fixture",
        );
      const startDate = new Date(`${todayIST()}T00:00:00Z`);
      startDate.setUTCDate(startDate.getUTCDate() - 5);
      await page
        .getByLabel("Reporting start date", { exact: true })
        .fill(startDate.toISOString().slice(0, 10));
      await page
        .getByText("I confirm all opening balances, including zero balances.", {
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Save opening balances", exact: true })
        .click();
    }
    await expect(
      page.getByRole("button", { name: "Today’s Entry", exact: true }),
    ).toBeVisible();
  }
}
async function editSaved(page: any) {
  const edit = page.getByRole("button", { name: "Edit entry", exact: true });
  if (await edit.isVisible()) await edit.click();
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
test("office submission, polling dashboard, correction and history", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const office = await a.newPage(),
    commissioner = await b.newPage();
  await login(office, testOfficeAccount);
  await expect(office.getByRole("heading").first()).toBeVisible();
  await expect(
    office.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await login(commissioner, "commissioner");
  await expect(
    commissioner.getByRole("heading", { name: "Office monitoring dashboard" }),
  ).toBeVisible();
  await expect(
    commissioner.getByText("Polling", { exact: false }).first(),
  ).toBeVisible();
  const row = commissioner
    .locator("tbody tr")
    .filter({ hasText: `Anchal ${testOfficeId}` })
    .first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await editSaved(office);
  await office
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await office.getByLabel("Ward number / name").fill("Ward 1");
  await office.getByLabel("Received / Transactions", { exact: true }).fill("5");
  await office.getByLabel("Disposed / Completed", { exact: true }).fill("2");
  await office.getByLabel("SLA Within Time", { exact: true }).fill("2");
  await office.getByLabel("Avg Disposal Days", { exact: true }).fill("1.5");
  const amount = ((10000 + (Date.now() % 100000)) / 100).toFixed(2);
  const expectedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(amount));
  await office.getByLabel("Amount Collected (₹)", { exact: true }).fill(amount);
  const correction = await office
    .getByLabel("Correction reason", { exact: true })
    .isVisible();
  if (correction)
    await office.getByLabel("Correction reason").fill("Browser verification");
  const committed = office
    .waitForResponse(
      (r) =>
        r.url().includes("/v1/api/anchal/office/entries") &&
        ["POST", "PUT"].includes(r.request().method()),
    )
    .then((r) => {
      expect(r.ok()).toBe(true);
      return Date.now();
    });
  await office
    .getByRole("button", {
      name: correction ? "Save correction →" : "Submit entry →",
      exact: true,
    })
    .click();
  const start = await committed;
  await expect(row).toContainText(expectedAmount, { timeout: 2000 });
  expect(Date.now() - start).toBeLessThan(2000);
  await expect(office.getByRole("status")).toContainText("Entry saved");
  await editSaved(office);
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
  await editSaved(office);
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
  await login(page, testOfficeAccount);
  await expect(
    page.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "02 Holding tax payment", exact: false })
    .click();
  await expect(
    page.getByLabel("Received / Transactions", { exact: true }),
  ).toHaveValue("");
  await editSaved(page);
  await page
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await expect(
    page.getByLabel("Received / Transactions", { exact: true }),
  ).toHaveValue("0");
});
test("back-entry displays service date and immutable registration date separately", async ({
  page,
}) => {
  await login(page, testOfficeAccount);
  await expect(
    page.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Backdate Entry", exact: true })
    .click();
  const serviceDateField = page.getByLabel("Service date", { exact: true });
  const serviceDate = await serviceDateField.getAttribute("min");
  expect(serviceDate).toBeTruthy();
  if (serviceDate! >= todayIST())
    test.skip(
      true,
      "Office reporting start date does not yet allow back-entry",
    );
  await serviceDateField.fill(serviceDate!);
  await expect(serviceDateField).toHaveValue(serviceDate!);
  await expect(
    page.getByLabel("Reporting / registration date", { exact: true }),
  ).toHaveValue(todayIST());
  await expect(
    page.getByLabel("Reporting / registration date", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await editSaved(page);
  await page
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await page.getByLabel("Ward number / name").fill("Ward 1");
  const correction = await page
    .getByLabel("Correction reason", { exact: true })
    .isVisible();
  if (correction)
    await page
      .getByLabel("Correction reason", { exact: true })
      .fill("Back-entry date verification");
  await page
    .getByRole("button", {
      name: correction ? "Save correction →" : "Submit entry →",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("Entry saved");
  await expect(serviceDateField).toHaveValue(serviceDate!);
  await expect(
    page.getByLabel("Reporting / registration date", { exact: true }),
  ).toHaveValue(todayIST());
  await expect(
    page.getByText("Registered at:", { exact: false }),
  ).toBeVisible();
});
test("backdate reason is required for a new report and absent from Today's Entry", async ({
  page,
}) => {
  if (!localSetupFixture)
    test.skip(
      true,
      "Backdate mutation is restricted to the explicit local fixture",
    );
  await login(page, testOfficeAccount);
  await page
    .getByRole("button", { name: "Backdate Entry", exact: true })
    .click();
  const serviceDate = page.getByLabel("Service date", { exact: true });
  if ((await serviceDate.getAttribute("min"))! >= todayIST())
    test.skip(
      true,
      "Office reporting start date does not yet allow back-entry",
    );
  const unsubmitted = page
    .locator(".service-status[aria-label='Not submitted']")
    .first();
  if (!(await unsubmitted.count()))
    test.skip(
      true,
      "Every service already has a backdated entry in the local fixture",
    );
  await unsubmitted.locator("xpath=..").click();
  await page
    .getByRole("button", { name: "Set zero activity", exact: true })
    .click();
  await page.getByLabel("Ward number / name", { exact: true }).fill("Ward 2");
  const delayedReason = page.getByLabel("Reason for delayed reporting", {
    exact: true,
  });
  await expect(delayedReason).toBeVisible();
  await expect(delayedReason).toHaveAttribute("required", "");
  expect(
    await delayedReason.evaluate(
      (element: HTMLTextAreaElement) => !element.checkValidity(),
    ),
  ).toBe(true);
  await delayedReason.fill("Report received after daily close");
  await page
    .getByRole("button", { name: "Submit entry →", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Entry saved");
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  const correctionReason = page.getByLabel("Correction reason", {
    exact: true,
  });
  await expect(correctionReason).toBeVisible();
  await expect(correctionReason).toHaveAttribute("required", "");
  await page
    .getByRole("button", { name: "Today’s Entry", exact: true })
    .click();
  await expect(
    page.getByLabel("Reason for delayed reporting", { exact: true }),
  ).toHaveCount(0);
});
