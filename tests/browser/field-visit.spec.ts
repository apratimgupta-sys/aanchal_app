import { test, expect, type Page } from "@playwright/test";

const OFFICER_SESSION = {
  userId: "off-1",
  username: "je.kadru",
  role: "officer",
  officeId: null,
  expiresAt: 0,
  officer: {
    id: "off-1",
    username: "je.kadru",
    name: "A. Kumar",
    designation: "Junior Engineer",
    homeOfficeId: 3,
    active: true,
  },
};

const COMMISSIONER_SESSION = {
  userId: "c-1",
  username: "commissioner",
  role: "commissioner",
  officeId: null,
  expiresAt: 0,
};

function storedVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: "10:30",
    officeId: 3,
    ward: 24,
    serviceId: 9,
    gps: { latitude: 23.3441, longitude: 85.3096, accuracyMetres: 18, capturedAt: new Date().toISOString() },
    issueAction: "Fogging done along the main lane; two bylanes still pending.",
    officerId: "off-1",
    officerName: "A. Kumar",
    officerDesignation: "Junior Engineer",
    receivedAt: new Date().toISOString(),
    verifiedOnSite: true,
    voidedAt: null,
    voidReason: null,
    ...overrides,
  };
}

async function signedInAs(page: Page, session: unknown) {
  await page.route("**/v1/api/anchal/session", (route) => route.fulfill({ json: session }));
}

test.describe("field visit module", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 23.3441, longitude: 85.3096 } });

  test("an officer records a visit and sees it in their own list", async ({ page }) => {
    await signedInAs(page, OFFICER_SESSION);
    const created: Array<Record<string, unknown>> = [];
    await page.route("**/v1/api/anchal/field-visits", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { input: Record<string, unknown> };
        created.push(body.input);
        return route.fulfill({ status: 201, json: storedVisit(body.input) });
      }
      return route.fulfill({ json: { rows: created.map((input) => storedVisit(input)), total: created.length } });
    });
    await page.route("**/v1/api/anchal/field-visits?*", (route) =>
      route.fulfill({ json: { rows: created.map((input) => storedVisit(input)), total: created.length } }),
    );

    await page.goto("/anchal/officer/visit");
    await expect(page.getByRole("heading", { name: "Record a field visit" })).toBeVisible();

    await page.getByLabel("Ward").selectOption("24");
    await page.getByLabel("Activity").selectOption("9");
    await page
      .getByLabel("Issue / Action")
      .fill("Fogging done along the main lane; two bylanes still pending.");
    await page.getByRole("button", { name: "Capture location" }).click();
    await expect(page.getByText(/±\s*\d+\s*m/)).toBeVisible();

    await page.getByRole("button", { name: "Submit visit" }).click();
    await expect(page.getByText("Visit recorded.")).toBeVisible();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ officeId: 3, ward: 24, serviceId: 9 });

    await page.getByRole("button", { name: "My visits" }).click();
    await expect(page.getByText(/Fogging done along the main lane/)).toBeVisible();
  });

  test("a denied location explains itself and blocks submission", async ({ browser }) => {
    const context = await browser.newContext();
    await context.clearPermissions();
    const page = await context.newPage();
    await signedInAs(page, OFFICER_SESSION);

    await page.goto("/anchal/officer/visit");
    await page.getByRole("button", { name: "Capture location" }).click();
    await expect(page.getByText(/Location permission is switched off/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit visit" })).toBeDisabled();
    await context.close();
  });

  test("the commissioner reads the register and voids a visit with a reason", async ({ page }) => {
    await signedInAs(page, COMMISSIONER_SESSION);
    let voided = false;
    await page.route("**/v1/api/anchal/field-visits?*", (route) =>
      route.fulfill({
        json: {
          rows: [
            voided
              ? storedVisit({ voidedAt: new Date().toISOString(), voidReason: "Filed against the wrong ward" })
              : storedVisit(),
          ],
          total: 1,
        },
      }),
    );
    await page.route("**/v1/api/anchal/field-visits/v1/void", async (route) => {
      voided = true;
      const body = route.request().postDataJSON() as { reason: string };
      expect(body.reason).toBe("Filed against the wrong ward");
      return route.fulfill({ json: storedVisit({ voidedAt: new Date().toISOString(), voidReason: body.reason }) });
    });

    await page.goto("/anchal/commissioner/visits");
    await expect(page.getByRole("heading", { name: "Field visit register" })).toBeVisible();
    await expect(page.getByText("A. Kumar")).toBeVisible();

    await page.getByRole("button", { name: "Void", exact: true }).click();
    await page.getByRole("button", { name: "Confirm void" }).click();
    await expect(page.getByText(/Give a reason/)).toBeVisible();

    await page.getByLabel("Reason").fill("Filed against the wrong ward");
    await page.getByRole("button", { name: "Confirm void" }).click();
    await expect(page.getByText(/Voided: Filed against the wrong ward/)).toBeVisible();
  });
});
