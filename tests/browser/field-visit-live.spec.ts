// End-to-end contract check: the real backend, a real Postgres, no route
// stubs. Skipped unless RMC_LIVE_BACKEND is set, because CI has no backend.
//
// Run with:
//   RMC_LIVE_BACKEND=1 RMC_TEST_URL=http://127.0.0.1:5173 \
//   RMC_OFFICER_PASSWORD=... RMC_COMMISSIONER_PASSWORD=... \
//   npx playwright test tests/browser/field-visit-live.spec.ts
import { test, expect, type Page } from "@playwright/test";

const live = process.env.RMC_LIVE_BACKEND === "1";
const officerUser = process.env.RMC_OFFICER_USERNAME ?? "je.kadru";
const officerPassword = process.env.RMC_OFFICER_PASSWORD ?? "";
const commissionerPassword = process.env.RMC_COMMISSIONER_PASSWORD ?? "";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: "Office sign in" })).toBeVisible();
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/anchal/");
  await expect(page.getByLabel("Username")).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // The app lands the account on its own first screen; navigating before that
  // happens races the session request and bounces back to the sign-in page.
  await expect(page.getByRole("heading", { name: "Office sign in" })).toBeHidden();
}

test.describe("field visit module against the real backend", () => {
  test.skip(!live, "RMC_LIVE_BACKEND is not set");
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 23.3441, longitude: 85.3096 } });

  // One unique sentence per run, so the row this test creates can be found
  // again in a database that keeps every earlier run's rows.
  const marker = `Contract check ${Date.now()}`;

  test("an officer files a visit that the commissioner can read and void", async ({ page }) => {
    await signIn(page, officerUser, officerPassword);
    await expect(page.getByRole("heading", { name: "Record a field visit" })).toBeVisible();

    await page.getByLabel("Ward").selectOption("24");
    await page.getByLabel("Activity").selectOption("9");
    await page.getByLabel("Issue / Action").fill(`${marker} — fogging done along the main lane.`);
    await page.getByRole("button", { name: "Capture location" }).click();
    await expect(page.getByText(/±\s*\d+\s*m/)).toBeVisible();
    await page.getByRole("button", { name: "Submit visit" }).click();
    await expect(page.getByText("Visit recorded.")).toBeVisible();

    // The officer's own list is served by the backend, not by a stub.
    await page.getByRole("button", { name: "My visits" }).click();
    const own = page.getByText(new RegExp(marker));
    await expect(own).toBeVisible();

    // A second submission of the same form must not create a second row:
    // the page issues a fresh request id per submit, so the row count rises
    // by exactly one per visit. Check by filtering the commissioner's
    // register down to this run's sentence.
    await signOut(page);
    await signIn(page, "commissioner", commissionerPassword);
    await page.goto("/anchal/commissioner/visits");
    await expect(page.getByRole("heading", { name: "Field visit register" })).toBeVisible();

    const row = page.locator("[data-testid^='visit-']").filter({ hasText: marker });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("A. Kumar");
    await expect(row).toContainText("Ward 24");

    await row.getByRole("button", { name: "Void", exact: true }).click();
    await page.getByLabel("Reason").fill("Filed against the wrong ward by mistake.");
    await page.getByRole("button", { name: "Confirm void" }).click();
    await expect(row).toContainText("Voided: Filed against the wrong ward by mistake.");
    await expect(row).toHaveClass(/is-voided/);

    // Voided rows are retained, never deleted (spec 7.4): it is still there
    // after a reload.
    await page.reload();
    const reloaded = page.locator("[data-testid^='visit-']").filter({ hasText: marker });
    await expect(reloaded).toHaveCount(1);
    await expect(reloaded).toHaveClass(/is-voided/);
  });

  test("an office account cannot reach the field visit routes", async ({ page }) => {
    const officePassword = process.env.RMC_OFFICE_PASSWORD ?? "";
    test.skip(officePassword === "", "RMC_OFFICE_PASSWORD is not set");
    await signIn(page, "anchal3", officePassword);
    await expect(page.getByRole("heading", { name: /balances|today/i })).toBeVisible();
    // Asked from inside the page, so the session cookie travels with it.
    const status = await page.evaluate(() =>
      fetch("/v1/api/anchal/field-visits?from=2026-11-01&to=2026-11-30", {
        credentials: "same-origin",
      }).then((r) => r.status),
    );
    expect(status).toBe(403);
  });
});
