// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
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
  return Array.from(document.querySelectorAll("form .ui-field label"))
    .map((l) => (l.textContent ?? "").replace(/\s*\*\s*$/, "").trim())
    .filter((l) => l !== DATE_LABEL);
}

async function renderFor(id: number, entries: EntryView[] = []) {
  cleanup();
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") =>
    method === "GET" ? { setup: null, entries, openings: [] } : {},
  );
  const user = userEvent.setup();
  render(
    <Language.Provider value="en">
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
  await screen.findByText(/daily service entry/i);
  if (id !== 1) {
    const list = screen.getByRole("list", { name: /municipal services/i });
    await user.click(Array.from(list.querySelectorAll("button"))[id - 1]);
  }
  await screen.findByText(
    new RegExp(`SERVICE ${String(id).padStart(2, "0")}\\b`),
  );
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

describe("the three shapes", () => {
  it("shows a counter service two numbers", async () => {
    await renderFor(1);
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
      "Payments",
      "Amount Collected (₹)",
      "Remarks",
    ]);
  });

  it("shows a field-work service one work-done figure and no money", async () => {
    await renderFor(15);
    expect(labels()).toEqual(["Ward", "Sites", "Remarks"]);
  });

  it("asks the grievance service as a counter service", async () => {
    await renderFor(12);
    expect(labels()).toEqual([
      "Ward",
      "Received",
      "Disposed",
      "Remarks",
    ]);
  });

  it("shows no retired field on any shape", async () => {
    for (const id of [1, 2, 15]) {
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

  it("labels work done per service", async () => {
    for (const [id, label] of [
      [8, "Trips"],
      [9, "Routes"],
      [10, "Animals picked up"],
      [13, "Repairs"],
      [14, "Works"],
      [15, "Sites"],
      [16, "Sites"],
      [17, "Routes"],
    ] as const) {
      await renderFor(id);
      expect(labels()).toContain(label);
    }
  });

  it("shows the opening pending strip on the counter shape only", async () => {
    await renderFor(1);
    expect(screen.getByText("Opening pending")).toBeTruthy();
    await renderFor(2);
    expect(screen.queryByText("Opening pending")).toBeNull();
    await renderFor(15);
    expect(screen.queryByText("Opening pending")).toBeNull();
  });
});

describe("what goes over the wire", () => {
  it("sends zero, never null, for a field the shape hides", async () => {
    const user = await renderFor(15);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^sites\b/i), "4");
    await submitEntry(user);
    const { input } = await sentOverTheWire("POST");
    expect(input).toMatchObject({
      received: 0,
      completed: 4,
      slaWithinTime: 0,
      complaintsReceived: 0,
      complaintsResolved: 0,
      fieldReceived: 0,
      fieldCompleted: 0,
      amountPaise: 0,
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

  it("sends zero for the counter shape's hidden fields and money", async () => {
    const user = await renderFor(1);
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
    await user.type(screen.getByLabelText(/^payments\b/i), "9");
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
  // Zeroing a historical field-work entry's Received would change the
  // commissioner's register and the disposal-percentage denominator.
  it("keeps a pre-cutover entry's hidden values when correcting it", async () => {
    const user = await renderFor(15, [preCutoverEntry(15)]);
    await startCorrection(user);
    const sites = screen.getByLabelText(/^sites\b/i);
    await user.clear(sites);
    await user.type(sites, "6");
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
  // Payments below the stored completed of 5; field work lowers Work done.
  it.each([
    [1, /^disposed\b/i, "3", { completed: 3, received: 7 }],
    [2, /^payments\b/i, "3", { received: 3, completed: 5 }],
    [15, /^sites\b/i, "2", { completed: 2, received: 7 }],
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
    // Saved slaWithinTime is 4; correcting work done to 2 trips the retired
    // "within SLA cannot exceed completed" rule, whose message has nowhere to
    // render on this shape.
    const user = await renderFor(15, [preCutoverEntry(15)]);
    await startCorrection(user);
    const sites = screen.getByLabelText(/^sites\b/i);
    await user.clear(sites);
    await user.type(sites, "2");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    const { input } = await sentOverTheWire("PUT");
    expect(input).toMatchObject({ completed: 2, slaWithinTime: 4 });
    expect(screen.queryByText(/please correct the highlighted fields/i)).toBeNull();
  });
});

describe("a server error on a field the form does not render", () => {
  it("is shown in full rather than highlighting nothing", async () => {
    const user = await renderFor(15);
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
    await user.type(screen.getByLabelText(/^sites\b/i), "4");
    await submitEntry(user);
    // The key the form does render still highlights its own field.
    await waitFor(() =>
      expect(
        screen.getByText(/select a ward from 1 to 53/i).className,
      ).toContain("field-error"),
    );
    // The one it does not render is spelled out in the form-level error, with
    // the field named, instead of vanishing.
    const unhandled = screen.getByText(/cannot exceed completed cases/i);
    expect(unhandled.textContent).toContain("Completed within SLA");
  });

  it("names the nothing-to-report flag rather than printing its key", async () => {
    const user = await renderFor(15);
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
    await user.type(screen.getByLabelText(/^sites\b/i), "4");
    await submitEntry(user);
    const shown = await screen.findByText(/cannot be combined with reported/i);
    expect(shown.textContent).toContain("Nothing to report");
    expect(shown.textContent).not.toContain("nothingToReport");
  });
});
