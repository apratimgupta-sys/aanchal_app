// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import { servicePosition } from "./service-position";
import DailyEntry from "../../src/client/pages/DailyEntry";
import { todayIST } from "../../src/domain/ledger";
import type { EntryView } from "../../src/shared/types";

const api = vi.hoisted(() => vi.fn());
const RequestError = vi.hoisted(
  () =>
    class RequestError extends Error {
      detail: { fieldErrors?: Record<string, string> | null };
      constructor(
        message: string,
        detail: { fieldErrors?: Record<string, string> | null } = {},
      ) {
        super(message);
        this.detail = detail;
      }
    },
);
vi.mock("../../src/client/api", () => ({ api, RequestError }));

// The read-only reporting date is not a question the office answers, so it is
// not part of a shape's field set.
const DATE_LABEL = "Reporting / registration date";

function labels() {
  return Array.from(document.querySelectorAll("form label"))
    .map((l) => (l.textContent ?? "").replace(/\s*\*\s*$/, "").trim())
    .filter((l) => l !== DATE_LABEL);
}

type Opening = { serviceId: number; opening: { service: number; complaints: number; field: number } };

async function renderFor(id: number, entries: EntryView[] = [], openings: Opening[] = [], lang: "en" | "hi" = "en") {
  cleanup();
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") =>
    method === "GET" ? { setup: null, entries, openings } : {},
  );
  const user = userEvent.setup();
  render(
    <Language.Provider value={lang}>
      <DailyEntry
        officeId={1}
        mode="today"
        startDate="2020-01-01"
        onDirtyChange={() => {}}
        preserveDraftSignal={0}
        onContinueDraftInBackdate={() => {}}
      />
    </Language.Provider>,
  );
  await screen.findByText(lang === "hi" ? /दैनिक सेवा/ : /daily service entry/i);
  if (id !== 1) {
    await user.click(screen.getByRole("button", { name: new RegExp(`^${servicePosition(id)}(?!\\d)`) }));
  }
  if (lang === "en") await screen.findByText(new RegExp(`SERVICE ${servicePosition(id)}\\b`));
  return user;
}

async function submitEntry(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /submit entry/i }));
}

async function sentBody(method: "POST" | "PUT") {
  await waitFor(() =>
    expect(api.mock.calls.some((c) => c[1] === method)).toBe(true),
  );
  return api.mock.calls.find((c) => c[1] === method)![2];
}

// What the server actually receives: NaN serializes to JSON null, and the API
// reads the body with JsonNumberHandling.Strict, so null into a long is a 422.
async function sentOverTheWire(method: "POST" | "PUT") {
  return JSON.parse(JSON.stringify(await sentBody(method)));
}

const preCutoverEntry = (serviceId: number): EntryView => ({
  id: "entry-1",
  officeId: 1,
  serviceId,
  serviceDate: todayIST(),
  reportingDate: todayIST(),
  ward: "Ward 24",
  received: 7,
  completed: 5,
  slaWithinTime: 4,
  amountPaise: 1234,
  complaintsReceived: 2,
  complaintsResolved: 1,
  fieldReceived: 3,
  fieldCompleted: 3,
  avgDisposalDays: 2.5,
  remarks: "filed before the cutover",
  nothingToReport: false,
  version: 1,
  createdAt: "2026-11-01T04:30:00Z",
  updatedAt: "2026-11-01T04:30:00Z",
  opening: { service: 0, complaints: 0, field: 0 },
  closing: { service: 2, complaints: 1, field: 0 },
});

beforeEach(() => {
  cleanup();
  api.mockReset();
});

// The shapes that collect a single kind of figure. The one that collects a queue
// and money together has its own describe further down.
describe("the counter, revenue and field-work shapes", () => {
  it("shows a counter service two numbers", async () => {
    await renderFor(11);
    expect(labels()).toEqual([
      "Ward",
      "Received",
      "Disposed",
      "Remarks",
    ]);
  });

  it("shows a revenue service payments and money", async () => {
    await renderFor(2);
    expect(labels()).toEqual([
      "Ward",
      "Number of Payments",
      "Amount Collected (₹)",
      "Remarks",
    ]);
  });

  it("asks the grievance service as a counter service", async () => {
    await renderFor(12);
    expect(labels()).toEqual([
      "Ward",
      "Number of grievances posted through Smart Ranchi",
      "Number of grievances resolved through Smart Ranchi",
      "Remarks",
    ]);
  });

  it("shows no retired field on any shape", async () => {
    for (const id of [1, 11, 2]) {
      await renderFor(id);
      for (const gone of [
        "SLA Within Time",
        "Complaints Received",
        "Complaints Resolved",
        "Field Tasks Received",
        "Field Tasks Completed",
        "Avg Disposal Days",
        "Received / Transactions",
        "Disposed / Completed",
      ])
        expect(labels()).not.toContain(gone);
    }
  });

  it("shows the opening pending strip on the services that have a queue only", async () => {
    await renderFor(11);
    expect(screen.getByText("Opening pending")).toBeTruthy();
    await renderFor(2);
    expect(screen.queryByText("Opening pending")).toBeNull();
    await renderFor(5);
    expect(screen.queryByText("Opening pending")).toBeNull();
  });
});

describe("what goes over the wire", () => {
  it("sends zero for the counter shape's hidden fields and money", async () => {
    const user = await renderFor(11);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^received\b/i), "5");
    await user.type(screen.getByLabelText(/^disposed\b/i), "3");
    await submitEntry(user);
    const { input } = await sentOverTheWire("POST");
    expect(input).toMatchObject({
      received: 5,
      completed: 3,
      slaWithinTime: 0,
      fieldReceived: 0,
      amountPaise: 0,
      remarks: "",
    });
  });

  it("sends the revenue shape's payments and amount with no disposal", async () => {
    const user = await renderFor(2);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^number of payments\b/i), "9");
    await user.clear(screen.getByLabelText(/^amount collected/i));
    await user.type(screen.getByLabelText(/^amount collected/i), "150.50");
    await submitEntry(user);
    const { input } = await sentOverTheWire("POST");
    expect(input).toMatchObject({
      received: 9,
      completed: 0,
      slaWithinTime: 0,
      complaintsReceived: 0,
      complaintsResolved: 0,
      fieldReceived: 0,
      fieldCompleted: 0,
      amountPaise: 15050,
      remarks: "",
    });
    for (const k of [
      "received",
      "completed",
      "slaWithinTime",
      "complaintsReceived",
      "complaintsResolved",
      "fieldReceived",
      "fieldCompleted",
      "amountPaise",
    ])
      expect(input[k]).not.toBeNull();
  });
});

describe("correcting an entry filed before the change", () => {
  async function startCorrection(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /edit entry/i }));
    await user.type(
      screen.getByLabelText(/correction reason/i),
      "recount of the work log",
    );
  }

  // Review Focus 3. The correction path loads a saved entry into form state and
  // resends it whole, so a hidden field must survive the round trip untouched.
  // Zeroing a historical entry's hidden SLA or complaint counts would change the
  // commissioner's register. (Field-work entries are no longer corrected here:
  // the daily entry does not offer those services, and the server refuses it.)
  it("keeps a pre-cutover entry's hidden values when correcting it", async () => {
    const user = await renderFor(11, [preCutoverEntry(11)]);
    await startCorrection(user);
    const disposed = screen.getByLabelText(/^disposed\b/i);
    await user.clear(disposed);
    await user.type(disposed, "6");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    const { input } = await sentOverTheWire("PUT");
    expect(input).toMatchObject({
      received: 7,
      completed: 6,
      slaWithinTime: 4,
      complaintsReceived: 2,
      complaintsResolved: 1,
      fieldReceived: 3,
      fieldCompleted: 3,
      amountPaise: 1234,
      avgDisposalDays: 2.5,
    });
  });

  // The dead end the review enumerated, once per shape: a stored hidden figure
  // must not be able to refuse a correction to the figure the office can see.
  // Counter lowers Disposed below the stored slaWithinTime of 4; revenue lowers
  // Payments below the stored completed of 5.
  it.each([
    [11, /^disposed\b/i, "3", { completed: 3, received: 7 }],
    [2, /^number of payments\b/i, "3", { received: 3, completed: 5 }],
  ] as const)(
    "lowers the visible figure on service %i without a dead end",
    async (serviceId, label, typed, expected) => {
      const user = await renderFor(serviceId, [preCutoverEntry(serviceId)]);
      await startCorrection(user);
      const box = screen.getByLabelText(label);
      await user.clear(box);
      await user.type(box, typed);
      await user.click(screen.getByRole("button", { name: /save correction/i }));
      const { input } = await sentOverTheWire("PUT");
      expect(input).toMatchObject({
        ...expected,
        slaWithinTime: 4,
        complaintsReceived: 2,
        complaintsResolved: 1,
        fieldReceived: 3,
        fieldCompleted: 3,
        amountPaise: 1234,
      });
      expect(
        screen.queryByText(/please correct the highlighted fields/i),
      ).toBeNull();
    },
  );

  it("is not blocked by a cross-field rule on a field the shape hides", async () => {
    // Saved slaWithinTime is 4; correcting disposed to 2 trips the retired
    // "within SLA cannot exceed completed" rule, whose message has nowhere to
    // render on this shape.
    const user = await renderFor(11, [preCutoverEntry(11)]);
    await startCorrection(user);
    const disposed = screen.getByLabelText(/^disposed\b/i);
    await user.clear(disposed);
    await user.type(disposed, "2");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    const { input } = await sentOverTheWire("PUT");
    expect(input).toMatchObject({ completed: 2, slaWithinTime: 4 });
    expect(screen.queryByText(/please correct the highlighted fields/i)).toBeNull();
  });
});

describe("a server error on a field the form does not render", () => {
  it("is shown in full rather than highlighting nothing", async () => {
    const user = await renderFor(11);
    api.mockImplementation(async (_path: string, method = "GET") => {
      if (method === "GET") return { setup: null, entries: [], openings: [] };
      throw new RequestError("Please correct the highlighted fields", {
        fieldErrors: {
          "input.slaWithinTime": "Cannot exceed completed cases",
          "input.ward": "Select a ward from 1 to 53",
        },
      });
    });
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^received\b/i), "4");
    await user.type(screen.getByLabelText(/^disposed\b/i), "3");
    await submitEntry(user);
    // The key the form does render still highlights its own field.
    await waitFor(() =>
      expect(
        screen.getByText(/select a ward from 1 to 53/i).className,
      ).toContain("text-destructive"),
    );
    // The one it does not render is spelled out in the form-level error, with
    // the field named, instead of vanishing.
    const unhandled = screen.getByText(/cannot exceed completed cases/i);
    expect(unhandled.textContent).toContain("Completed within SLA");
  });

  it("names the nothing-to-report flag rather than printing its key", async () => {
    const user = await renderFor(11);
    api.mockImplementation(async (_path: string, method = "GET") => {
      if (method === "GET") return { setup: null, entries: [], openings: [] };
      throw new RequestError("Please correct the highlighted fields", {
        fieldErrors: {
          "input.nothingToReport":
            "Nothing to report cannot be combined with reported figures",
        },
      });
    });
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^received\b/i), "4");
    await user.type(screen.getByLabelText(/^disposed\b/i), "3");
    await submitEntry(user);
    const shown = await screen.findByText(/cannot be combined with reported/i);
    expect(shown.textContent).toContain("Nothing to report");
    expect(shown.textContent).not.toContain("nothingToReport");
  });

  // The server refuses a daily entry for a field-work service on `serviceId`
  // alone. A clerk's tab still on the bundle from before the change can reach
  // this; the refusal must read as a sentence about a service, not as a wire key.
  it.each([
    ["en", "Service"],
    ["hi", "सेवा"],
  ] as const)("names the service rather than printing its key (%s)", async (lang, label) => {
    const user = await renderFor(11, [], [], lang);
    api.mockImplementation(async (_path: string, method = "GET") => {
      if (method === "GET") return { setup: null, entries: [], openings: [] };
      throw new RequestError("Please correct the highlighted fields", {
        fieldErrors: {
          "input.serviceId": "Field work is reported by field officers, not on the daily entry",
        },
      });
    });
    await user.selectOptions(document.querySelector("form select")!, "Ward 24");
    const [received, disposed] = Array.from(document.querySelectorAll<HTMLInputElement>("form input[inputmode=numeric], form input[type=number]"));
    await user.type(received, "4");
    await user.type(disposed, "3");
    await user.click(screen.getByRole("button", { name: /submit entry|प्रविष्टि जमा करें/i }));
    const shown = await screen.findByText(/क्षेत्रीय अधिकारी|field officers/i);
    expect(shown.textContent).toContain(label);
    expect(shown.textContent).not.toContain("serviceId");
  });
});

// A clerk typing one zero too many in the amount is the ordinary way to reach
// the server's amount bound. The rejection must land under the amount box, not
// only in a page-level notice that points at nothing.
describe("a server error on the amount", () => {
  it.each([1, 2])("is shown under the amount box on service %i", async (id) => {
    const user = await renderFor(id);
    api.mockImplementation(async (_path: string, method = "GET") => {
      if (method === "GET") return { setup: null, entries: [], openings: [] };
      throw new RequestError("Please correct the highlighted fields", {
        fieldErrors: {
          "input.amountPaise": "Enter a nonnegative whole number within the allowed limit",
        },
      });
    });
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    for (const l of document.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      await user.type(l, "1");
    const amount = screen.getByLabelText(/^amount collected/i);
    await user.clear(amount);
    await user.type(amount, "99999999.00");
    await submitEntry(user);
    const message = await screen.findByText(/within the allowed limit/i);
    // On the amount's own field: a destructive-coloured message that the
    // input is marked invalid against and described by, not a bullet in the
    // page-level notice.
    expect(message.className).toContain("text-destructive");
    expect(message.closest("li")).toBeNull();
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    const described = (amount.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    expect(described.some((el) => el!.contains(message))).toBe(true);
  });
});

// Services 1, 3, 4 and 7 collect a queue AND money. Every assertion here is
// about what the form asks for, never about what the shape is called.
describe("a service that collects a queue and money together", () => {
  const withOpening = (serviceId: number, service: number): Opening => ({
    serviceId,
    opening: { service, complaints: 0, field: 0 },
  });
  const closing = () =>
    document.querySelector("[data-closing] strong")!.textContent;

  it.each([1, 3, 4, 7])("service %i asks for both counts and the amount", async (id) => {
    await renderFor(id);
    expect(labels()).toEqual([
      "Ward",
      "Applications received",
      "Applications disposed",
      "Amount Collected (₹)",
      "Remarks",
    ]);
  });

  it("shows the opening strip and the closing readout, which a collection-only service lacks", async () => {
    await renderFor(1, [], [withOpening(1, 10)]);
    expect(screen.getByText("Opening pending")).toBeTruthy();
    expect(document.querySelector("[data-opening] strong")!.textContent).toBe("10");
    expect(document.querySelector("[data-closing]")).not.toBeNull();
    await renderFor(2);
    expect(document.querySelector("[data-opening]")).toBeNull();
    expect(document.querySelector("[data-closing]")).toBeNull();
  });

  it("files the counts, the parsed amount, and zero for everything the service does not collect", async () => {
    const user = await renderFor(1);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^applications received\b/i), "5");
    await user.type(screen.getByLabelText(/^applications disposed\b/i), "3");
    await user.clear(screen.getByLabelText(/^amount collected/i));
    await user.type(screen.getByLabelText(/^amount collected/i), "150.50");
    await submitEntry(user);
    const { input } = await sentOverTheWire("POST");
    expect(input).toMatchObject({
      serviceId: 1,
      received: 5,
      completed: 3,
      amountPaise: 15050,
      slaWithinTime: 0,
      complaintsReceived: 0,
      complaintsResolved: 0,
      fieldReceived: 0,
      fieldCompleted: 0,
    });
  });

  it("moves the closing pending exactly as the equivalent counter entry does", async () => {
    // Opening 10, 5 in, 3 out: 12 on a plain counter service, so 12 here.
    const closes: string[] = [];
    for (const id of [11, 1, 3, 4, 7]) {
      const user = await renderFor(id, [], [withOpening(id, 10)]);
      await user.type(screen.getByLabelText(/^(applications )?received\b/i), "5");
      await user.type(screen.getByLabelText(/^(applications )?disposed\b/i), "3");
      closes.push(closing()!);
    }
    expect(closes).toEqual(["12", "12", "12", "12", "12"]);
  });

  it("does not let money move the balance", async () => {
    const user = await renderFor(1, [], [withOpening(1, 10)]);
    await user.type(screen.getByLabelText(/^applications received\b/i), "5");
    await user.type(screen.getByLabelText(/^applications disposed\b/i), "3");
    await user.clear(screen.getByLabelText(/^amount collected/i));
    await user.type(screen.getByLabelText(/^amount collected/i), "9999");
    expect(closing()).toBe("12");
  });

  it("holds disposed to no more than received, on the field the office can see", async () => {
    const user = await renderFor(1);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^applications received\b/i), "3");
    await user.type(screen.getByLabelText(/^applications disposed\b/i), "5");
    await user.clear(screen.getByLabelText(/^amount collected/i));
    await user.type(screen.getByLabelText(/^amount collected/i), "10");
    await submitEntry(user);
    expect(await screen.findByText(/please correct the highlighted fields/i)).toBeTruthy();
    expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(false);
  });

  it("requires both counts on filing, not just the one that was always there", async () => {
    const user = await renderFor(1);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^applications received\b/i), "3");
    await user.clear(screen.getByLabelText(/^amount collected/i));
    await user.type(screen.getByLabelText(/^amount collected/i), "10");
    // Disposed left empty. The input is `required`, so submit through the form
    // to reach the schema the way a browser that skipped validation would.
    const form = screen.getByLabelText(/^applications received\b/i).closest("form")!;
    form.noValidate = true;
    await submitEntry(user);
    expect(await screen.findByText(/please correct the highlighted fields/i)).toBeTruthy();
    expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(false);
  });

  it("lists service 1 under Counter work and badges it so, without a group of its own", async () => {
    await renderFor(1);
    const group = screen.getByRole("button", { name: /counter work/i });
    const panel = document.getElementById(group.getAttribute("aria-controls")!)!;
    expect(panel.textContent).toContain("01");
    expect(screen.getAllByRole("heading", { level: 2 }).filter((h) => h.querySelector("button")).length).toBe(2);
    expect(document.querySelector("form")?.closest("section, div")?.textContent).toContain("Counter work");
  });
});

// Review Focus: a service-1 entry filed while it was a counter service stored
// amountPaise 0. Opening it must not conjure a figure, and must not cost the
// entry anything else it holds.
describe("correcting a service-1 entry filed before it collected money", () => {
  const filedAsCounter = (): EntryView => ({
    ...preCutoverEntry(1),
    amountPaise: 0,
    received: 7,
    completed: 5,
    closing: { service: 2, complaints: 1, field: 0 },
  });
  const money = () => screen.getByLabelText(/^amount collected/i) as HTMLInputElement;

  async function startCorrection(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /edit entry/i }));
    await user.type(screen.getByLabelText(/correction reason/i), "recount");
  }

  it("opens with an empty or zero amount, never a figure", async () => {
    await renderFor(1, [filedAsCounter()]);
    expect(["", "0", "0.00"]).toContain(money().value);
  });

  it("saves the amount as zero and keeps every other stored value", async () => {
    const user = await renderFor(1, [filedAsCounter()]);
    await startCorrection(user);
    const disposed = screen.getByLabelText(/^applications disposed\b/i);
    await user.clear(disposed);
    await user.type(disposed, "6");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    const { input } = await sentOverTheWire("PUT");
    expect(input).toMatchObject({
      received: 7,
      completed: 6,
      amountPaise: 0,
      slaWithinTime: 4,
      complaintsReceived: 2,
      complaintsResolved: 1,
      fieldReceived: 3,
      fieldCompleted: 3,
      avgDisposalDays: 2.5,
      remarks: "filed before the cutover",
      ward: "Ward 24",
    });
    expect(screen.queryByText(/please correct the highlighted fields/i)).toBeNull();
  });

  it("lets the office supply the amount it never had", async () => {
    const user = await renderFor(1, [filedAsCounter()]);
    await startCorrection(user);
    await user.clear(money());
    await user.type(money(), "75.25");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    const { input } = await sentOverTheWire("PUT");
    expect(input).toMatchObject({ amountPaise: 7525, received: 7, completed: 5, slaWithinTime: 4 });
  });

  it("closes the balance from the stored opening, as before", async () => {
    await renderFor(1, [{ ...filedAsCounter(), opening: { service: 4, complaints: 0, field: 0 } }]);
    expect(document.querySelector("[data-closing] strong")!.textContent).toBe("6");
  });
});

// The client's wording for the services it renamed. Only the four fee services
// and the grievance service are worded differently; every other service keeps
// "Received" / "Disposed".
describe("the labels the client asked for", () => {
  const SMART_RANCHI = [
    "Number of grievances posted through Smart Ranchi",
    "Number of grievances resolved through Smart Ranchi",
  ];

  it.each([1, 3, 4, 7])("service %i says applications received and disposed, and keeps its amount", async (id) => {
    await renderFor(id);
    expect(labels()).toEqual([
      "Ward",
      "Applications received",
      "Applications disposed",
      "Amount Collected (₹)",
      "Remarks",
    ]);
  });

  it("service 12 says grievances posted and resolved through Smart Ranchi, with no amount", async () => {
    await renderFor(12);
    expect(labels()).toEqual(["Ward", ...SMART_RANCHI, "Remarks"]);
    expect(labels()).not.toContain("Amount Collected (₹)");
  });

  it("service 11 keeps Received and Disposed, with no amount", async () => {
    await renderFor(11);
    expect(labels()).toEqual(["Ward", "Received", "Disposed", "Remarks"]);
  });

  it("every other counter service keeps Received and Disposed", async () => {
    for (const id of [24]) {
      await renderFor(id);
      expect(labels(), `service ${id}`).toEqual(["Ward", "Received", "Disposed", "Remarks"]);
    }
  });

  it("renders the Smart Ranchi labels in Hindi too, and the renamed service title", async () => {
    cleanup();
    api.mockReset();
    api.mockImplementation(async (_p: string, m = "GET") =>
      m === "GET" ? { setup: null, entries: [], openings: [] } : {},
    );
    const user = userEvent.setup();
    render(
      <Language.Provider value="hi">
        <DailyEntry officeId={1} mode="today" startDate="2020-01-01" onDirtyChange={() => {}}
          preserveDraftSignal={0} onContinueDraftInBackdate={() => {}} />
      </Language.Provider>,
    );
    await screen.findByText(/दैनिक सेवा प्रविष्टि/);
    await user.click(screen.getByRole("button", { name: new RegExp(`^${servicePosition(12)}(?!\\d)`) }));
    const text = Array.from(document.querySelectorAll("form label")).map((l) => l.textContent ?? "").join("|");
    expect(text).toMatch(/स्मार्ट राँची/);
    expect(text).not.toMatch(/Smart Ranchi/);
  });
});

describe("the service list carries the six new names", () => {
  it("lists them in English", async () => {
    await renderFor(1);
    const list = screen.getByRole("list", { name: "Municipal services" });
    for (const name of [
      "New Holding Application Reporting (SAF)",
      "Municipal Trade Licence Application Reporting",
      "New Water Connection Application Reporting",
      "Data Correction Application Reporting",
      "Birth and Death Registration Reporting",
      "Public Grievance Application Reporting",
    ])
      expect(within(list).getByText(name)).toBeTruthy();
  });
});
