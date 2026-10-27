import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { todayIST } from "../../src/domain/ledger";
const credentials: Record<string, string> | null = process.env
  .RMC_CREDENTIALS_FILE
  ? JSON.parse(readFileSync(process.env.RMC_CREDENTIALS_FILE, "utf8"))
  : null;
const localSetupFixture =
  process.env.RMC_TEST_LOCAL === "1" &&
  !!process.env.RMC_TEST_URL &&
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.RMC_TEST_URL).hostname,
  );
const testOfficeAccount = `anchal${Number(
  process.env.RMC_TEST_OFFICE ?? (process.env.RMC_TEST_URL ? 6 : 1),
)}`;
function credentialFor(user: string) {
  const credential = credentials?.[user] ?? process.env.RMC_TEST_PASSWORD;
  if (!credential)
    throw new Error(
      "Browser tests require RMC_CREDENTIALS_FILE or RMC_TEST_PASSWORD; no test credential is configured.",
    );
  return credential;
}
async function signIn(page: import("@playwright/test").Page, user: string) {
  await page.goto("/anchal/");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page
    .getByLabel("Password", { exact: true })
    .fill(credentialFor(user));
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  if (
    user.startsWith("anchal") &&
    (await page
      .getByRole("heading", { name: "Set opening balances", exact: true })
      .isVisible())
  ) {
    if (!localSetupFixture)
      test.skip(
        true,
        "Office setup is absent; baseline writes are disabled outside the explicit local fixture",
      );
    const startDate = new Date(`${todayIST()}T00:00:00Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 5);
    await page
      .getByLabel("Reporting start date")
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
}
async function setTheme(page: import("@playwright/test").Page, theme: string) {
  await page.evaluate(async (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    // Flush styles, then wait for current colour transitions before scanning.
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
      "button:not(:disabled):not(.app-menu-button):not(.app-drawer-close), .ui-input, .ui-select, .ui-textarea, .ui-checkbox-control, summary",
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
test("login: keyboard access, light/dark contrast and four responsive modes", async ({
  page,
}) => {
  await page.route("**/v1/api/anchal/session", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "UNAUTHENTICATED", message: "Sign in required" },
    }),
  );
  await page.goto("/anchal/");
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
      .locator(".ui-input")
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
        path: `test-results/login-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
test("dashboard and entry: responsive tables, labelled controls and colour contrast", async ({
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
      path: `test-results/dashboard-${theme}-mobile.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, testOfficeAccount);
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
  await signIn(page, testOfficeAccount);
  await expect(
    page.getByLabel("Ward number / name"),
  ).toBeVisible();
  const edit = page.getByRole("button", { name: "Edit entry", exact: true });
  if (await edit.isVisible()) await edit.click();
  const rows = page.locator(".service-list button");
  await page
    .getByLabel("Ward number / name")
    .fill("Unsaved ward draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await rows.nth(1).click();
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(rows.nth(1)).not.toHaveClass(/\bactive\b/);
  await expect(
    page.getByLabel("Ward number / name"),
  ).toHaveValue("Unsaved ward draft");
  page.once("dialog", (dialog) => dialog.accept());
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
});
test("submitted entries stay read-only until Edit and Cancel restores saved values", async ({
  page,
}) => {
  await signIn(page, testOfficeAccount);
  const ward = page.getByLabel("Ward number / name");
  const edit = page.getByRole("button", { name: "Edit entry", exact: true });
  const submit = page.getByRole("button", {
    name: "Submit entry →",
    exact: true,
  });
  await expect(edit.or(submit)).toBeVisible();
  if (!(await edit.isVisible())) {
    if (!localSetupFixture)
      test.skip(
        true,
        "A saved today entry is required for the read-only check",
      );
    await page.getByRole("button", { name: "Set zero activity" }).click();
    await ward.fill("Ward 1");
    await submit.click();
    await expect(page.getByRole("status")).toContainText("Entry saved");
  }
  await expect(edit).toBeVisible();
  await expect(ward).toHaveAttribute("readonly", "");
  await expect(
    page.getByRole("button", { name: "Submit entry →", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("View service date", { exact: true }),
  ).toHaveCount(0);
  const saved = await ward.inputValue();
  await edit.click();
  await expect(ward).not.toHaveAttribute("readonly", "");
  await ward.fill("Canceled edit");
  await page
    .getByRole("button", { name: "Cancel editing", exact: true })
    .click();
  await expect(ward).toHaveValue(saved);
  await expect(ward).toHaveAttribute("readonly", "");
});

test("office routes gate first login on setup and separate today from backdating", async ({
  page,
}) => {
  let configured = false;
  let reportingStartDate = "2026-10-01";
  let entryReads = 0;
  await page.route("**/v1/api/anchal/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/api/anchal/session") {
      await route.fulfill({
        json: {
          userId: "anchal-route-test",
          username: "anchal1",
          role: "office",
          officeId: 1,
          expiresAt: Date.now() + 60_000,
        },
      });
      return;
    }
    if (url.pathname === "/v1/api/anchal/office/setup") {
      if (route.request().method() === "PUT") configured = true;
      await route.fulfill({
        json: configured
          ? {
              officeId: 1,
              startDate: reportingStartDate,
              version: 1,
              balances: Array.from({ length: 25 }, (_, i) => ({
                serviceId: i + 1,
                opening: { service: 0, complaints: 0, field: 0 },
              })),
            }
          : null,
      });
      return;
    }
    if (url.pathname === "/v1/api/anchal/office/entries") {
      entryReads++;
      await route.fulfill({
        json: { setup: null, entries: [], openings: [] },
      });
      return;
    }
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/anchal/");
  await expect(page).toHaveURL(/\/office\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Set opening balances" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily service entry" }),
  ).toHaveCount(0);
  const startDate = new Date(`${todayIST()}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 3);
  reportingStartDate = startDate.toISOString().slice(0, 10);
  await page
    .getByLabel("Reporting start date")
    .fill(reportingStartDate);
  await page
    .getByText("I confirm all opening balances, including zero balances.", {
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save opening balances", exact: true })
    .click();
  await expect(page).toHaveURL(/\/office\/today$/);
  await page.reload();
  await expect(page).toHaveURL(/\/office\/today$/);
  await page.goto("/anchal/office/setup");
  await expect(page).toHaveURL(/\/office\/today$/);
  await expect(
    page.getByRole("button", { name: "Today’s Entry", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Backdate Entry", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Service date", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Backdate Entry", exact: true })
    .click();
  await expect(page).toHaveURL(/\/office\/backdate$/);
  const serviceDate = page.getByLabel("Service date", { exact: true });
  await expect(serviceDate).toHaveAttribute("min", reportingStartDate);
  await expect(serviceDate).toHaveAttribute("max", /.+/);
  await page.goBack();
  await expect(page).toHaveURL(/\/office\/today$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/office\/backdate$/);
  const readsBeforeUnavailableDate = entryReads;
  reportingStartDate = todayIST();
  await page.goto("/anchal/office/backdate");
  await expect(
    page.getByText(
      "Backdated entry becomes available the day after the reporting start date.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Service date", { exact: true })).toHaveCount(0);
  expect(entryReads).toBe(readsBeforeUnavailableDate + 1);
});

test("an office login without setup redirects to the setup form without crashing", async ({
  page,
}) => {
  let signedIn = false;
  await page.route("**/v1/api/anchal/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/api/anchal/login") {
      signedIn = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (url.pathname === "/v1/api/anchal/session") {
      if (!signedIn)
        return route.fulfill({
          status: 401,
          json: { code: "UNAUTHENTICATED", message: "Sign in required" },
        });
      return route.fulfill({
        json: {
          userId: "unconfigured-office",
          username: "anchal3",
          role: "office",
          officeId: 3,
          expiresAt: Date.now() + 60_000,
        },
      });
    }
    if (url.pathname === "/v1/api/anchal/office/setup")
      return route.fulfill({ json: null });
    return route.fulfill({
      status: 404,
      json: { code: "NOT_FOUND", message: "unmocked" },
    });
  });

  await page.goto("/anchal/");
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("anchal3");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(page).toHaveURL(/\/anchal\/office\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Set opening balances", exact: true }),
  ).toBeVisible();
});

test("office navigation can be canceled without losing a dirty entry", async ({
  page,
}) => {
  test.skip(
    true,
    "Requires an isolated mutable fixture; shared staging is intentionally not used for mutation tests.",
  );
  await signIn(page, testOfficeAccount);
  const edit = page.getByRole("button", { name: "Edit entry", exact: true });
  const submit = page.getByRole("button", {
    name: "Submit entry →",
    exact: true,
  });
  await expect(edit.or(submit)).toBeVisible();
  if (await edit.isVisible()) await edit.click();
  await page
    .getByLabel("Ward number / name")
    .fill("Draft ward retained");
  await page.getByLabel("Received / Transactions", { exact: true }).fill("17");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Backdate Entry", exact: true })
    .click();
  await expect(page).toHaveURL(/\/office\/today$/);
  await expect(
    page.getByLabel("Ward number / name"),
  ).toHaveValue("Draft ward retained");
  await expect(
    page.getByLabel("Received / Transactions", { exact: true }),
  ).toHaveValue("17");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.evaluate(() => {
    window.history.pushState({}, "", "/office/backdate");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/office\/today$/);
  await expect(
    page.getByLabel("Ward number / name"),
  ).toHaveValue("Draft ward retained");
});

test("an open Today draft rolls forward at IST midnight and can continue as Backdate", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-05T18:29:00.000Z") });
  await page.route("**/v1/api/anchal/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/api/anchal/session") {
      await route.fulfill({
        json: {
          userId: "anchal-midnight-test",
          username: "anchal1",
          role: "office",
          officeId: 1,
          expiresAt: Date.now() + 60_000,
        },
      });
      return;
    }
    if (url.pathname === "/v1/api/anchal/office/setup") {
      await route.fulfill({
        json: {
          officeId: 1,
          startDate: "2026-10-01",
          version: 1,
          balances: Array.from({ length: 25 }, (_, i) => ({
            serviceId: i + 1,
            opening: { service: 0, complaints: 0, field: 0 },
          })),
        },
      });
      return;
    }
    if (url.pathname === "/v1/api/anchal/office/entries") {
      await route.fulfill({ json: { setup: null, entries: [], openings: [] } });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/anchal/office/today");
  await expect(
    page.getByRole("heading", { name: "Daily service entry" }),
  ).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(
    page.getByLabel("Reporting / registration date", { exact: true }),
  ).toHaveValue("2026-10-06");
  await page.getByRole("button", { name: "Set zero activity" }).click();
  await page
    .getByLabel("Ward number / name")
    .fill("Midnight draft");
  await page.clock.setFixedTime(new Date("2026-10-06T18:30:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText(
    "The IST reporting day has changed.",
  );
  await page
    .getByRole("button", { name: "Continue draft in Backdate Entry" })
    .click();
  await expect(page).toHaveURL(/\/office\/backdate$/);
  await expect(page.getByLabel("Service date", { exact: true })).toHaveValue(
    "2026-10-06",
  );
  await expect(
    page.getByLabel("Ward number / name"),
  ).toHaveValue("Midnight draft");
  await expect(
    page.getByLabel("Reason for delayed reporting"),
  ).toBeVisible();
});

async function mockUnconfiguredOffice(
  page: import("@playwright/test").Page,
  onPut: (body: unknown) => { status: number; json: unknown },
) {
  const puts: unknown[] = [];
  await page.route("**/v1/api/anchal/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/api/anchal/session")
      return route.fulfill({
        json: {
          userId: "anchal-setup-test",
          username: "anchal3",
          role: "office",
          officeId: 3,
          expiresAt: Date.now() + 60_000,
        },
      });
    if (url.pathname === "/v1/api/anchal/office/setup") {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        puts.push(body);
        return route.fulfill(onPut(body));
      }
      return route.fulfill({ json: null });
    }
    return route.fulfill({ status: 404, json: { code: "NOT_FOUND", message: "unmocked" } });
  });
  return puts;
}

test("setup form blocks invalid values with visible field errors and sends nothing", async ({
  page,
}) => {
  const puts = await mockUnconfiguredOffice(page, () => ({ json: {} }));
  await page.goto("/anchal/office/setup");
  await expect(
    page.getByRole("heading", { name: "Set opening balances" }),
  ).toBeVisible();
  const confirm = page.getByText(
    "I confirm all opening balances, including zero balances.",
    { exact: true },
  );
  const save = page.getByRole("button", { name: "Save opening balances", exact: true });

  await page.getByLabel("Reporting start date").fill("2999-01-01");
  await confirm.click();
  await save.click();
  await expect(
    page.getByText("Reporting start date cannot be in the future"),
  ).toBeVisible();

  await page.getByLabel("Reporting start date").fill(todayIST());
  await page.getByLabel("1 service", { exact: true }).fill("-5");
  await save.click();
  await expect(page.getByText("Enter a number of 0 or more")).toBeVisible();
  await page.getByLabel("1 service", { exact: true }).fill("1000000001");
  await save.click();
  await expect(page.getByText("Enter a number up to 1,000,000,000")).toBeVisible();
  await page.getByLabel("1 service", { exact: true }).fill("1.5");
  await save.click();
  await expect(page.getByText("Enter a whole number").first()).toBeVisible();
  expect(puts).toHaveLength(0);
});

test("setup form places server field errors on the matching cell", async ({
  page,
}) => {
  const puts = await mockUnconfiguredOffice(page, () => ({
    status: 422,
    json: {
      code: "VALIDATION",
      message: "Please correct the highlighted fields",
      fieldErrors: { "balances[2].opening.complaints": "Enter a valid value" },
    },
  }));
  await page.goto("/anchal/office/setup");
  await page
    .getByText("I confirm all opening balances, including zero balances.", {
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save opening balances", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Please correct the highlighted fields",
  );
  const cell = page.getByLabel("3 complaints", { exact: true });
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid value")).toBeVisible();
  expect(puts).toHaveLength(1);
});
