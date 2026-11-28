// The gate for the daily-form service shapes (three of them now: field work is
// reported by officers as visits, not on this form): the real backend, a real
// Postgres, no route stubs. Twice in this project a green unit suite sat on top
// of a broken path, because the tests exercised the layer that changed rather
// than the path an office walks. This walks it.
//
// It is skipped unless RMC_LIVE_BACKEND is set, because CI has no backend.
//
// Run with (passwords from the protected env file, never from this file):
//   RMC_LIVE_BACKEND=1 RMC_TEST_URL=http://127.0.0.1:5173 \
//   RMC_OFFICER_USERNAME=anchal1 RMC_OFFICER_PASSWORD=... \
//   RMC_COMMISSIONER_PASSWORD=... \
//   npx playwright test tests/browser/daily-form-live.spec.ts
//
// PRECONDITION: a freshly provisioned database, with no office setups and no
// entries. Opening balances lock permanently the first time they are saved —
// per office, not per day — and this spec saves them through the UI and then
// asserts that a second save is refused. So an office that has run this spec
// can never run it again, on any day, and after six runs the database is spent.
//
// Reset it first, with the API stopped:
//
//   export PGPASSWORD=...
//   . /path/to/jwt.env
//   RMC_CREDENTIALS_FILE=/path/to/anchal-provisioning.env \
//     tests/browser/reset-live-stack.sh
//
// then start the API again. The script drops and recreates the database,
// applies the migrations and re-provisions the seven accounts; it writes no
// opening balances, because that screen is what this spec walks.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { FIELD_WORK_IDS, OFFERED_IDS, servicePosition } from "../ui/service-position";

const live = process.env.RMC_LIVE_BACKEND === "1";
const officeUser = process.env.RMC_OFFICER_USERNAME ?? "anchal1";
// anchal4 signs in as Anchal 4 on the commissioner's filter. The totals below
// are narrowed to the office that filed them, whichever of the six it is.
const officeNumber = Number(officeUser.replace(/\D/g, "")) || 1;
const officePassword = process.env.RMC_OFFICER_PASSWORD ?? "";
const commissionerPassword = process.env.RMC_COMMISSIONER_PASSWORD ?? "";
// Screenshots are evidence, not repo content, so they are written outside the
// working tree.
const evidenceDir = process.env.RMC_EVIDENCE_DIR ?? "/home/claude/live";

// The opening balances this run enters, and why each one is here. They lock on
// save, so they are planned rather than improvised:
//   1  counter, the plain case — a non-zero opening pending the register must show
//   7  counter, the pre-cutover correction case
//  12  counter, though its monitoring kind is grievance; must still move
//  24  counter, the "nothing to report" case — must not move
//   2  revenue    — non-zero on purpose: it must still be frozen
//   5  revenue    — a second one, so collection is proved to accumulate
//   8  field work — non-zero on purpose. Opening balances still cover all 25
//      services, so the grid must still take one; it is a field-work service no
//      form reports against now, and the dashboard's pending total (32 below)
//      must not pick it up. Nothing is filed against it.
// Every other service opens at zero so the dashboard arithmetic below is exact.
const OPENING: Record<number, number> = { 1: 7, 2: 11, 5: 9, 7: 3, 8: 13, 12: 5, 24: 4 };

// The figures filed, and the totals they must produce on the dashboard. The
// three tile figures are kept mutually distinct so a tile reading the wrong
// total cannot pass by accident.
const FILED = {
  counterPending: 32, // 12 (s1) + 7 (s7) + 9 (s12) + 4 (s24)
  counterReceived: 23, // 9 + 8 + 6 + 0
  counterCompleted: 10, // 4 + 4 + 2 + 0
  // 125050 (s2) + 30025 (s5) + 15000 (s6, after its correction) + 25075 (s1,
  // a queue service that also takes a fee: collection spans it too)
  collection: "₹1,951.50",
  collectionPaise: 195150,
  // s1 s2 s5 s6 s7 s12 s24. The daily entry collects 10 services, so an office
  // that filed all of them reads 10 / 10 and one that filed these reads 7 / 10.
  entries: 7,
  expected: 10,
};

type ApiResponse<T> = { status: number; body: T };

// page.request does not carry the browser context's cookie, so the API is read
// and written from inside the page.
async function callApi<T = unknown>(
  page: Page,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const call = { path, method, body: body === undefined ? null : JSON.stringify(body) };
  return (await page.evaluate(
    async (c: { path: string; method: string; body: string | null }) => {
      const response = await fetch("/v1/api/anchal" + c.path, {
        method: c.method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: c.body === null ? undefined : c.body,
      });
      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    },
    call,
  )) as ApiResponse<T>;
}

type LiveEntry = {
  id: string;
  version: number;
  serviceId: number;
  received: number;
  completed: number;
  slaWithinTime: number;
  amountPaise: number;
  complaintsReceived: number;
  complaintsResolved: number;
  fieldReceived: number;
  fieldCompleted: number;
  avgDisposalDays: number | null;
  nothingToReport: boolean;
  ward: string;
  opening: { service: number; complaints: number; field: number };
  closing: { service: number; complaints: number; field: number };
};

async function storedEntry(page: Page, serviceId: number, date: string) {
  const { status, body } = await callApi<{ entries: LiveEntry[] }>(
    page,
    `/office/entries?date=${date}&mode=today`,
  );
  expect(status, "reading today's entries").toBe(200);
  const entry = body.entries.find((e) => e.serviceId === serviceId);
  expect(entry, `service ${serviceId} is stored for ${date}`).toBeDefined();
  return entry!;
}

// An entry filed the way an office filed last week, with every retired field
// populated. Over the API, because no form collects them any more.
async function filePreCutover(
  page: Page,
  serviceId: number,
  date: string,
  figures: Partial<LiveEntry> & { ward: string },
) {
  const filed = await callApi<LiveEntry>(page, "/office/entries", "POST", {
    requestId: `precutover-${serviceId}-${Date.now()}`,
    expectedVersion: null,
    mode: "today",
    reason: null,
    input: {
      serviceId,
      serviceDate: date,
      received: 0,
      completed: 0,
      slaWithinTime: 0,
      amountPaise: 0,
      complaintsReceived: 0,
      complaintsResolved: 0,
      fieldReceived: 0,
      fieldCompleted: 0,
      avgDisposalDays: null,
      remarks: "Filed before the form was reduced.",
      nothingToReport: false,
      ...figures,
    },
  });
  expect(filed.status, JSON.stringify(filed.body)).toBe(200);
  return filed.body;
}

// Open a saved entry for editing and save the correction.
async function correct(
  page: Page,
  serviceId: number,
  fill: () => Promise<void>,
  reason: string,
) {
  await page.reload();
  await expect(page.getByRole("heading", { name: "Daily service entry" })).toBeVisible();
  await selectService(page, serviceId);
  await expect(page.locator(".entry-panel [data-status]")).toHaveText("Submitted");
  await page.getByRole("button", { name: "Edit entry" }).click();
  await fill();
  await textField(page, "Correction reason").fill(reason);
  await page.getByRole("button", { name: /Save correction/ }).click();
  await expect(page.getByText("Entry saved. Dashboard updated.")).toBeVisible();
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/anchal/");
  await expect(page.getByLabel("Username")).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // Navigating before the app has landed the account on its own first screen
  // races the session request and bounces back to sign-in.
  await expect(page.getByRole("heading", { name: "Office sign in" })).toBeHidden();
}

// The service register is grouped by shape (group wrappers are <li> too), so a
// service is found by its accessible name, which starts with its two-digit place
// in the list. That place is not the service id (see tests/ui/service-position.ts).
async function selectService(page: Page, id: number) {
  await page
    .getByRole("button", { name: new RegExp(`^${servicePosition(id)}(?!\\d)`) })
    .click();
  await expect(page.locator(".entry-panel .eyebrow")).toHaveText(
    new RegExp(`^SERVICE ${servicePosition(id)} ·`),
  );
}

const RETIRED_LABELS = [
  "SLA Within Time",
  "Complaints Received",
  "Complaints Resolved",
  "Field Tasks Received",
  "Field Tasks Completed",
  "Avg Disposal Days",
];

// Every field the entry form renders, by the name an office reads off it. The
// required marker is an aria-hidden "*" inside the label, so it is stripped.
async function formFieldNames(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".entry-panel form input, .entry-panel form select, .entry-panel form textarea"),
    ).map((el) => {
      const id = el.getAttribute("id");
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return (el.getAttribute("aria-label") ?? label?.textContent ?? "")
        .replace(/\s*\*\s*$/, "")
        .trim();
    }),
  );
}

// Asserted as an exact set, so a retired field cannot creep back in under a
// role or a label this suite did not think to name.
async function expectFormFields(page: Page, expected: string[]) {
  await expect(async () => {
    expect(await formFieldNames(page)).toEqual(expected);
  }).toPass({ timeout: 5000 });
  for (const label of RETIRED_LABELS)
    expect(expected, `${label} must not be collected`).not.toContain(label);
}

const DATE_AND_WARD = ["Reporting / registration date", "Ward"];

function numberField(page: Page, name: string) {
  return page.getByRole("spinbutton", { name, exact: true });
}

function selectField(page: Page, name: string) {
  return page.getByRole("combobox", { name, exact: true });
}

function textField(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

async function submitEntry(page: Page) {
  await page.getByRole("button", { name: /Submit entry/ }).click();
  await expect(page.getByText("Entry saved. Dashboard updated.")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("the daily form shapes against a real backend", () => {
  test.skip(!live, "RMC_LIVE_BACKEND is not set");

  let officeContext: BrowserContext;
  let commissionerContext: BrowserContext;
  let office: Page;
  let commissioner: Page;
  // The IST reporting day, read from the app rather than assumed, because the
  // server rejects an entry whose date is not today in IST.
  let today = "";

  test.beforeAll(async ({ browser }) => {
    expect(officePassword, "RMC_OFFICER_PASSWORD must be set").not.toBe("");
    expect(commissionerPassword, "RMC_COMMISSIONER_PASSWORD must be set").not.toBe("");
    // Two contexts, one sign-in each. Login is rate limited to 10 attempts per
    // minute per IP, and the header, the sidebar and the mobile drawer each
    // render a Sign out button, so signing one page in and out repeatedly is
    // both slower and ambiguous.
    officeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Wide enough for the three-tile row the stylesheet asks for from 1024px.
    commissionerContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    office = await officeContext.newPage();
    commissioner = await commissionerContext.newPage();
    // Switching service with an unsaved draft asks for confirmation. Playwright
    // dismisses dialogs by default, which window.confirm reads as "no".
    for (const page of [office, commissioner])
      page.on("dialog", (dialog) => void dialog.accept());
    // The IST reporting day, read in the browser rather than assumed: the
    // server rejects an entry whose date is not today in IST. Taken here, not
    // in the first test, so the dashboard test can be run on its own.
    await office.goto("/anchal/");
    today = await office.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
  });

  test.afterAll(async () => {
    await officeContext?.close();
    await commissionerContext?.close();
  });

  test("an office with no setup lands on the opening-balance screen and locks it on save", async () => {
    await signIn(office, officeUser, officePassword);

    const setupHeading = office.getByRole("heading", { name: "Set opening balances" });
    await expect(
      setupHeading,
      `${officeUser} has already completed its one-time opening balances, which cannot be re-entered. Point RMC_OFFICER_USERNAME at an office that has not.`,
    ).toBeVisible();

    // All 25 services must carry a figure. The grid starts every cell at 0, so
    // only the planned non-zero openings are typed.
    for (const [id, service] of Object.entries(OPENING))
      await office.getByLabel(`${id} service`, { exact: true }).fill(String(service));
    await expect(office.getByLabel("1 service", { exact: true })).toHaveValue("7");
    await office.getByRole("checkbox").check();
    await office.getByRole("button", { name: "Save opening balances" }).click();

    // Saving the setup is what admits the office to the form at all.
    await expect(office.getByRole("heading", { name: "Daily service entry" })).toBeVisible();

    const stored = await callApi<{ balances: { serviceId: number; opening: { service: number } }[] }>(
      office,
      "/office/setup",
    );
    expect(stored.status).toBe(200);
    expect(stored.body.balances).toHaveLength(25);
    for (const [id, service] of Object.entries(OPENING))
      expect(
        stored.body.balances.find((b) => b.serviceId === Number(id))?.opening.service,
        `opening pending for service ${id}`,
      ).toBe(service);

    // Opening balances are locked once saved: SaveSetupAsync must refuse a
    // second one rather than quietly rewriting the ledger's starting point.
    const again = await callApi(office, "/office/setup", "PUT", {
      requestId: "lockcheck-" + Date.now(),
      expectedVersion: null,
      startDate: today,
      balances: Array.from({ length: 25 }, (_, i) => ({
        serviceId: i + 1,
        opening: { service: 99, complaints: 0, field: 0 },
      })),
      reason: null,
    });
    expect(again.status, "a second setup must be refused").toBe(409);
  });

  test("a counter entry files with no average-days value and moves the balance", async () => {
    await selectService(office, 1);

    // A service that collects a queue has one to open against. Service 1 also
    // takes a fee, but that does not change that it has a queue.
    await expect(office.locator("[data-opening]")).toHaveCount(1);
    await expect(
      office.locator("[data-opening] strong"),
      "opening pending comes from the saved setup",
    ).toHaveText("7");
    await expectFormFields(office, [
      ...DATE_AND_WARD,
      "Applications received",
      "Applications disposed",
      "Amount Collected (₹)",
      "Remarks",
    ]);

    await selectField(office, "Ward").selectOption("Ward 11");
    await numberField(office, "Applications received").fill("9");
    await numberField(office, "Applications disposed").fill("4");
    await textField(office, "Amount Collected (₹)").fill("250.75");
    await expect(office.locator("[data-closing] strong")).toHaveText("12");
    await submitEntry(office);

    const entry = await storedEntry(office, 1, today);
    expect(entry.received).toBe(9);
    expect(entry.completed).toBe(4);
    expect(entry.amountPaise, "the fee collected on the applications").toBe(25075);
    // The form never asked for it and the server must not have invented one.
    expect(entry.avgDisposalDays, "average disposal days is collected from nobody").toBeNull();
    expect(entry.slaWithinTime).toBe(0);
    expect(entry.opening.service).toBe(7);
    expect(entry.closing.service, "counter work moves the pending balance").toBe(12);
  });

  test("revenue entries collect money and leave every pending balance alone", async () => {
    await selectService(office, 2);

    // No queue, so no opening or closing strip and no disposal figure.
    await expect(office.locator("[data-opening]")).toHaveCount(0);
    await expect(office.locator("[data-closing]")).toHaveCount(0);
    await expectFormFields(office, [
      ...DATE_AND_WARD,
      "Number of Payments",
      "Amount Collected (₹)",
      "Remarks",
    ]);

    await selectField(office, "Ward").selectOption("Ward 11");
    await numberField(office, "Number of Payments").fill("12");
    await textField(office, "Amount Collected (₹)").fill("1250.50");
    await submitEntry(office);

    const entry = await storedEntry(office, 2, today);
    expect(entry.received).toBe(12);
    expect(entry.amountPaise).toBe(125050);
    expect(entry.completed).toBe(0);
    expect(entry.opening.service).toBe(11);
    expect(entry.closing.service, "a payment must not move the queue").toBe(11);

    // A second revenue entry, on a different revenue service, because the
    // reporting start date is today and the same service and date can only be
    // filed once. One entry proves the rule; two prove it holds while money
    // accumulates, which is what a month of payments would do to the ledger.
    await selectService(office, 5);
    await expect(office.locator("[data-opening]")).toHaveCount(0);
    await expectFormFields(office, [
      ...DATE_AND_WARD,
      "Number of Payments",
      "Amount Collected (₹)",
      "Remarks",
    ]);
    await selectField(office, "Ward").selectOption("Ward 13");
    await numberField(office, "Number of Payments").fill("7");
    await textField(office, "Amount Collected (₹)").fill("300.25");
    await submitEntry(office);

    const second = await storedEntry(office, 5, today);
    expect(second.received).toBe(7);
    expect(second.amountPaise).toBe(30025);
    expect(second.completed).toBe(0);

    // Neither opening moved, and neither moved the other: the deriver has no
    // term for revenue at all, so each service's queue is where the setup left it.
    expect(second.opening.service).toBe(9);
    expect(second.closing.service, "a payment must not move the queue").toBe(9);
    const first = await storedEntry(office, 2, today);
    expect(first.opening.service, "service 2 opening, after service 5 filed").toBe(11);
    expect(first.closing.service, "service 2 closing, after service 5 filed").toBe(11);
  });

  test("the list offers ten services and no field work, and the server refuses it", async () => {
    // Field work is reported by officers as visits. The list holds the 10 the
    // entry collects, numbered 01 to 10, under two groups, and no Field work group.
    const list = office.getByRole("list", { name: "Municipal services" });
    const rows = list.locator("button:not([aria-expanded])");
    await expect(rows).toHaveCount(OFFERED_IDS.length);
    await expect(rows.first()).toHaveText(/^01/);
    await expect(rows.last()).toHaveText(/^10/);
    await expect(list.locator("button[aria-expanded]")).toHaveCount(2);
    await expect(list.getByText(/field work/i)).toHaveCount(0);

    // A stale page or a direct call is refused by the server, not merely hidden.
    // One request per field-work service, each refused on the service alone.
    for (const serviceId of FIELD_WORK_IDS) {
      const refused = await callApi<{ fieldErrors?: Record<string, string> }>(
        office,
        "/office/entries",
        "POST",
        {
          requestId: `fieldwork-${serviceId}-${Date.now()}`,
          expectedVersion: null,
          mode: "today",
          reason: null,
          input: {
            serviceId,
            serviceDate: today,
            ward: "Ward 11",
            received: 0,
            completed: 4,
            slaWithinTime: 0,
            amountPaise: 0,
            complaintsReceived: 0,
            complaintsResolved: 0,
            fieldReceived: 0,
            fieldCompleted: 0,
            avgDisposalDays: null,
            remarks: "",
            nothingToReport: false,
          },
        },
      );
      expect(refused.status, `a daily entry for service ${serviceId}`).toBe(422);
      expect(Object.keys(refused.body.fieldErrors ?? {}), `service ${serviceId}`).toEqual(["serviceId"]);
      expect(refused.body.fieldErrors?.serviceId).toMatch(/field officers/i);
    }

    // And nothing was stored for any of them.
    const stored = await callApi<{ entries: LiveEntry[] }>(office, `/office/entries?date=${today}&mode=today`);
    expect(stored.status).toBe(200);
    for (const serviceId of FIELD_WORK_IDS)
      expect(stored.body.entries.some((e) => e.serviceId === serviceId), `service ${serviceId} stored`).toBe(false);

    // A service withdrawn from the daily entry by decision is refused the same
    // way: 20 is hidden, 25 is removed. Each is refused on the service alone,
    // with the message that names the service and not field work.
    for (const serviceId of [20, 25]) {
      const withdrawn = await callApi<{ fieldErrors?: Record<string, string> }>(
        office,
        "/office/entries",
        "POST",
        {
          requestId: `withdrawn-${serviceId}-${Date.now()}`,
          expectedVersion: null,
          mode: "today",
          reason: null,
          input: {
            serviceId,
            serviceDate: today,
            ward: "Ward 11",
            received: 0,
            completed: 4,
            slaWithinTime: 0,
            amountPaise: 0,
            complaintsReceived: 0,
            complaintsResolved: 0,
            fieldReceived: 0,
            fieldCompleted: 0,
            avgDisposalDays: null,
            remarks: "",
            nothingToReport: false,
          },
        },
      );
      expect(withdrawn.status, `a daily entry for service ${serviceId}`).toBe(422);
      expect(Object.keys(withdrawn.body.fieldErrors ?? {}), `service ${serviceId}`).toEqual(["serviceId"]);
      expect(withdrawn.body.fieldErrors?.serviceId).toBe("This service is not reported on the daily entry");
    }
  });

  test("nothing to report is a flag, and the server refuses it beside a figure", async () => {
    await selectService(office, 24);
    await expect(office.locator("[data-opening] strong")).toHaveText("4");

    await selectField(office, "Ward").selectOption("Ward 11");
    await numberField(office, "Received").fill("0");
    await numberField(office, "Disposed").fill("0");
    await submitEntry(office);

    const entry = await storedEntry(office, 24, today);
    expect(entry.nothingToReport, "typed zeros are not the flag").toBe(false);
    expect(entry.received).toBe(0);
    expect(entry.completed).toBe(0);
    expect(entry.closing.service, "an idle day leaves the queue where it was").toBe(4);

    // The flag and a figure together are a contradiction the server must
    // reject. The form clears the flag as soon as a figure is typed, so this
    // rule is only reachable over the API.
    const contradiction = await callApi<{ fieldErrors?: Record<string, string> }>(
      office,
      "/office/entries",
      "POST",
      {
        requestId: "nothing-" + Date.now(),
        expectedVersion: null,
        mode: "today",
        reason: null,
        input: {
          serviceId: 11,
          serviceDate: today,
          ward: "Ward 11",
          received: 2,
          completed: 0,
          slaWithinTime: 0,
          amountPaise: 0,
          complaintsReceived: 0,
          complaintsResolved: 0,
          fieldReceived: 0,
          fieldCompleted: 0,
          avgDisposalDays: null,
          remarks: "",
          nothingToReport: true,
        },
      },
    );
    expect(contradiction.status).toBe(422);
    expect(contradiction.body.fieldErrors?.nothingToReport).toBeTruthy();
  });

  test("service 12 is a grievance service on the counter shape, and still moves the balance", async () => {
    await selectService(office, 12);

    // Its monitoring unit is Complaints, but it is a queue like any other: a
    // regression here is invisible to a check that only tries service 1.
    await expect(office.locator("[data-opening] strong")).toHaveText("5");
    await expectFormFields(office, [
      ...DATE_AND_WARD,
      "Number of grievances posted through Smart Ranchi",
      "Number of grievances resolved through Smart Ranchi",
      "Remarks",
    ]);

    await selectField(office, "Ward").selectOption("Ward 11");
    await numberField(office, "Number of grievances posted through Smart Ranchi").fill("6");
    await numberField(office, "Number of grievances resolved through Smart Ranchi").fill("2");
    await expect(office.locator("[data-closing] strong")).toHaveText("9");
    await submitEntry(office);

    const entry = await storedEntry(office, 12, today);
    expect(entry.opening.service).toBe(5);
    expect(entry.closing.service, "grievance work queues like any counter service").toBe(9);
  });

  test("a correction to a pre-cutover entry keeps the fields the form no longer shows", async () => {
    // Filed the way an office filed last week: every retired field populated.
    const filed = await callApi<LiveEntry>(office, "/office/entries", "POST", {
      requestId: "precutover-" + Date.now(),
      expectedVersion: null,
      mode: "today",
      reason: null,
      input: {
        serviceId: 7,
        serviceDate: today,
        ward: "Ward 9",
        received: 5,
        completed: 3,
        slaWithinTime: 2,
        amountPaise: 0,
        complaintsReceived: 4,
        complaintsResolved: 1,
        fieldReceived: 3,
        fieldCompleted: 2,
        avgDisposalDays: 2.5,
        remarks: "Filed before the form was reduced.",
        nothingToReport: false,
      },
    });
    expect(filed.status, JSON.stringify(filed.body)).toBe(200);
    expect(filed.body.avgDisposalDays).toBe(2.5);

    // Correct it through the form, which no longer renders any of those fields.
    // The correction resends the whole entry, so a wrong default here rewrites
    // history silently.
    await office.reload();
    await expect(office.getByRole("heading", { name: "Daily service entry" })).toBeVisible();
    await selectService(office, 7);
    await expectFormFields(office, [
      ...DATE_AND_WARD,
      "Applications received",
      "Applications disposed",
      "Amount Collected (₹)",
      "Remarks",
    ]);
    await expect(office.locator(".entry-panel [data-status]")).toHaveText("Submitted");

    await office.getByRole("button", { name: "Edit entry" }).click();
    await numberField(office, "Applications received").fill("8");
    await numberField(office, "Applications disposed").fill("4");
    await textField(office, "Correction reason").fill(
      "Two more cases were found in the register.",
    );
    await office.getByRole("button", { name: /Save correction/ }).click();
    await expect(office.getByText("Entry saved. Dashboard updated.")).toBeVisible();

    const corrected = await storedEntry(office, 7, today);
    expect(corrected.version).toBe(2);
    expect(corrected.received).toBe(8);
    expect(corrected.completed).toBe(4);
    expect(corrected.amountPaise, "the amount was filed as 0 and not touched").toBe(0);
    // None of these was on screen; all of them must have survived the round trip.
    expect(corrected.slaWithinTime, "within-SLA completions").toBe(2);
    expect(corrected.complaintsReceived, "complaints received").toBe(4);
    expect(corrected.complaintsResolved, "complaints resolved").toBe(1);
    expect(corrected.fieldReceived, "field tasks received").toBe(3);
    expect(corrected.fieldCompleted, "field tasks completed").toBe(2);
    expect(corrected.avgDisposalDays, "average disposal days").toBe(2.5);
    expect(corrected.closing.service).toBe(7);
  });

  // The queue-and-fee correction above is one of three shapes. Revenue is where the
  // hidden-field 422 was found, and it rests otherwise on a component test whose
  // mocked api cannot return a 422, so it could not have failed before the fix.
  // This runs against the real server. (Field work had a twin of it; a field-work
  // entry can no longer be filed or corrected, so there is nothing left to run.)
  test("a revenue correction keeps a stored disposal figure it never shows", async () => {
    await filePreCutover(office, 6, today, {
      ward: "Ward 14",
      received: 9,
      completed: 7,
      slaWithinTime: 5,
      amountPaise: 44000,
      avgDisposalDays: 1.5,
    });

    // The revenue form has no disposal box, so lowering Number of Payments below the
    // stored `completed` cannot be acted on and must not be rejected on it.
    await correct(
      office,
      6,
      async () => {
        await numberField(office, "Number of Payments").fill("3");
        await textField(office, "Amount Collected (₹)").fill("150.00");
      },
      "Three of the nine payments were counted twice.",
    );

    const entry = await storedEntry(office, 6, today);
    expect(entry.received, "payments lowered below the stored disposals").toBe(3);
    expect(entry.amountPaise).toBe(15000);
    expect(entry.completed, "a figure the revenue form never showed").toBe(7);
    expect(entry.slaWithinTime).toBe(5);
    expect(entry.avgDisposalDays).toBe(1.5);
    expect(entry.closing.service, "revenue still moves nothing").toBe(
      entry.opening.service,
    );
  });

  test("the commissioner dashboard has no work-done figure and none of the retired tiles", async () => {
    await signIn(commissioner, "commissioner", commissionerPassword);
    await expect(
      commissioner.getByRole("heading", { name: "Office monitoring dashboard" }),
    ).toBeVisible();
    // The Anchal card has no office filter, so the figures below are read from
    // this office's own row: exactly what was filed above, whatever other
    // offices hold. The card opens on Today, the day everything was filed.
    const anchalCard = commissioner
      .locator("section")
      .filter({ has: commissioner.getByRole("heading", { level: 2, name: "Anchal-wise performance" }) });
    const officeRow = anchalCard
      .getByRole("row")
      .filter({ has: commissioner.getByRole("cell", { name: `Anchal ${officeNumber}`, exact: true }) });

    // Field work is reported as visits, so the clerk's figure would read zero:
    // neither the tile nor the column is on the page. The server still sends
    // workDone and the page ignores it, so the figure must not reach the screen
    // even though it is in the response.
    await expect(commissioner.getByText("Work done"), "tile or column").toHaveCount(0);
    const columns = await commissioner
      .locator("[aria-label='Anchal-wise performance table'] thead th")
      .allTextContents();
    expect(columns.map((c) => c.trim())).toEqual([
      "Anchal",
      "Received",
      "Disposed",
      "Pending",
      "Disposal %",
      "Collected (₹)",
    ]);
    // The filter offers the 10 the entry collects, and none of the eight.
    const offered = await anchalCard
      .getByLabel("Service", { exact: true })
      .locator("option")
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean).map(Number));
    expect(offered).toEqual([...OFFERED_IDS].sort((a, b) => a - b));
    await expect(anchalCard.getByRole("option", { name: "All 10 services" })).toHaveCount(1);

    const rows = await callApi<{ rows: Record<string, unknown>[] }>(
      commissioner,
      `/dashboard?from=${today}&to=${today}&officeId=${officeNumber}`,
    );
    expect(rows.status).toBe(200);
    const row = rows.body.rows[0];
    // The seven it filed, out of the ten due; field work is in neither number.
    expect(row.submitted, "filed count over the collected services").toBe(FILED.entries);
    expect(row.expected, "the denominator is the ten the entry collects").toBe(FILED.expected);

    // The tiles and the filing count are gone from the page, not zeroed.
    for (const gone of ["Within SLA", "Complaints pending", "Field tasks pending", "Total pending", "Total collection"])
      await expect(commissioner.getByText(gone), `${gone} tile`).toHaveCount(0);
    await expect(commissioner.locator("[data-metric], [data-metrics], [data-report-count]")).toHaveCount(0);

    const figure = (label: string) => officeRow.locator(`td[data-label='${label}']`);
    await expect(figure("Pending")).toHaveText(String(FILED.counterPending));
    await expect(figure("Received")).toHaveText(String(FILED.counterReceived));
    await expect(figure("Disposed")).toHaveText(String(FILED.counterCompleted));
    const disposal = (FILED.counterCompleted / FILED.counterReceived) * 100;
    await expect(figure("Disposal %")).toHaveText(disposal.toFixed(1) + "%");
    // The sum of every entry that took money (three revenue services and one
    // fee on applications), not any one of them.
    await expect(figure("Collected (₹)")).toHaveText(FILED.collection);
    expect(row.amountPaise, "collection accumulates across every service that collects money").toBe(
      FILED.collectionPaise,
    );

    // The page itself must not scroll sideways at desktop width.
    expect(
      await commissioner.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      "the document must not scroll sideways",
    ).toBe(false);

    // Evidence for the eye as well as the assertion. The sign-in toast would
    // otherwise sit over the top of the page.
    await commissioner.locator("[data-sonner-toast]").first().waitFor({
      state: "detached",
      timeout: 10000,
    });
    await commissioner.evaluate(() => window.scrollTo(0, 0));
    await commissioner.screenshot({
      path: `${evidenceDir}/commissioner-dashboard.png`,
      fullPage: false,
    });

    // Columns went out of this table, and its min-width held the
    // width of the form they replaced. Asserted as a property rather than as
    // the numbers themselves: a floor must never exceed what the content could
    // ever need, and must not sit far above what the columns actually need.
    const widths = await commissioner.evaluate(() => {
      const measure = (selector: string) => {
        const table = document.querySelector(selector) as HTMLElement;
        const floor = parseFloat(getComputedStyle(table).minWidth);
        const saved = table.style.cssText;
        table.style.minWidth = "0px";
        table.style.width = "min-content";
        const min = table.getBoundingClientRect().width;
        table.style.width = "max-content";
        const max = table.getBoundingClientRect().width;
        table.style.cssText = saved;
        return { floor, min, max, columns: table.querySelectorAll("thead th").length };
      };
      return {
        anchal: measure("[aria-label='Anchal-wise performance table'] table"),
      };
    });
    for (const [name, t] of Object.entries(widths)) {
      expect(t.floor, `${name}: floor must not exceed max-content`).toBeLessThanOrEqual(t.max);
      expect(
        t.floor / t.min,
        `${name}: floor is ${(t.floor / t.min).toFixed(2)}x what its ${t.columns} columns need`,
      ).toBeLessThanOrEqual(1.35);
    }

    // And the page itself must not scroll sideways on a phone. Below lg each row
    // is a card, so the tables no longer need to scroll at all: every column is
    // still there (as a labelled cell) and nothing overflows its container.
    await commissioner.setViewportSize({ width: 375, height: 800 });
    const phone = await commissioner.evaluate(() => ({
      page:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      overflowing: Array.from(document.querySelectorAll("[data-scroll-x]")).map(
        (w) => w.scrollWidth > w.clientWidth,
      ),
      labelled: Array.from(document.querySelectorAll("[data-scroll-x] tbody td")).every((td) =>
        td.hasAttribute("data-label"),
      ),
    }));
    expect(phone.page, "the document must not scroll sideways at 375px").toBe(false);
    expect(phone.overflowing.some(Boolean), "no table needs horizontal dragging at 375px").toBe(false);
    expect(phone.labelled, "every cell names its column for the card layout").toBe(true);
    await commissioner.setViewportSize({ width: 1600, height: 1000 });
  });
});
