// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import Dashboard from "../../src/client/pages/Dashboard";
import { auditComparison, auditFields } from "../../src/client/audit";
import type { EntryView, MonitoringRow } from "../../src/shared/types";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

// The dashboard opens a live socket on mount. jsdom would try to dial it and
// retry on a timer, which has nothing to do with what these tests assert.
class SilentSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send() {}
  close() {}
}

function row(overrides: Partial<MonitoringRow> = {}): MonitoringRow {
  return {
    officeId: 1,
    received: 40,
    completed: 30,
    slaWithinTime: 25,
    pending: 12,
    disposalPct: 75,
    slaPct: 83.3,
    amountPaise: 250000,
    complaintsPending: 7,
    fieldPending: 9,
    workDone: 18,
    submitted: 25,
    expected: 25,
    configured: true,
    reviewReasons: [],
    ...overrides,
  };
}

function entry(overrides: Partial<EntryView> = {}): EntryView {
  return {
    id: "e1",
    officeId: 1,
    version: 1,
    serviceId: 1,
    serviceDate: "2026-11-19",
    reportingDate: "2026-11-19",
    ward: "12",
    received: 9,
    completed: 7,
    slaWithinTime: 6,
    amountPaise: 0,
    complaintsReceived: 3,
    complaintsResolved: 2,
    fieldReceived: 1,
    fieldCompleted: 1,
    avgDisposalDays: 4,
    remarks: "",
    nothingToReport: false,
    createdAt: "2026-11-19T05:00:00.000Z",
    updatedAt: "2026-11-19T05:00:00.000Z",
    opening: { service: 10, complaints: 3, field: 5 },
    closing: { service: 12, complaints: 4, field: 5 },
    ...overrides,
  };
}

function mockApi(rows: MonitoringRow[], entries: EntryView[] = []) {
  api.mockImplementation(async (path: string) =>
    path.startsWith("/dashboard/entries")
      ? entries
      : { rows, updatedAt: "2026-11-20T05:00:00.000Z" },
  );
}

async function renderDashboard(lang: "en" | "hi" = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <Dashboard />
      </Language.Provider>
    </QueryClientProvider>,
  );
  await screen.findByText(/anchal-wise performance|अंचलवार प्रदर्शन/i);
  // The tiles and the table render empty before the fetch resolves, so every
  // assertion below would pass on an empty dashboard without this.
  await waitFor(() =>
    expect(
      screen
        .getByLabelText(/anchal-wise performance table|अंचलवार प्रदर्शन तालिका/i)
        .querySelectorAll("tbody tr").length,
    ).toBeGreaterThan(0),
  );
}

// Both tables sit inside a scroll wrapper that carries the aria-label.
function labelledTable(label: RegExp) {
  const table = screen.getByLabelText(label).querySelector("table");
  if (!table) throw new Error("no table under " + label);
  return table as HTMLElement;
}

async function openRegister() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /view service entries/i }));
  await screen.findByText(/service entry register/i);
  return labelledTable(/service entry register table/i);
}

function headers(table: HTMLElement) {
  return Array.from(table.querySelectorAll("thead th")).map((th) =>
    (th.textContent ?? "").trim(),
  );
}

beforeEach(() => {
  cleanup();
  api.mockReset();
  vi.stubGlobal("WebSocket", SilentSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("commissioner dashboard after the form shapes", () => {
  it("has no complaints, field-task or SLA tile", async () => {
    mockApi([row()]);
    await renderDashboard();
    expect(screen.queryByText("Complaints pending")).toBeNull();
    expect(screen.queryByText("Field tasks pending")).toBeNull();
    expect(screen.queryByText("Within SLA")).toBeNull();
    const table = labelledTable(/anchal-wise performance table/i);
    for (const gone of ["SLA %", "Complaints Pending", "Field Tasks Pending"])
      expect(headers(table)).not.toContain(gone);
    // The figures themselves must be gone from the body and the totals row too.
    expect(screen.queryByText("83.3%")).toBeNull();
    expect(within(table).queryByText("7")).toBeNull();
    expect(within(table).queryByText("9")).toBeNull();
  });

  it("shows work done for the period", async () => {
    mockApi([row({ workDone: 18 }), row({ officeId: 2, workDone: 4 })]);
    await renderDashboard();
    const tile = screen.getByText("Work done this period").closest(".metric");
    expect(tile).not.toBeNull();
    expect(within(tile as HTMLElement).getByText("22")).toBeTruthy();
    cleanup();
    mockApi([row({ workDone: 18 })]);
    await renderDashboard("hi");
    expect(screen.getByText("इस अवधि में किया गया कार्य")).toBeTruthy();
  });

  it("leaves opening pending blank for a revenue service in the register", async () => {
    mockApi(
      [row()],
      [
        entry({ id: "counter", serviceId: 1, opening: { service: 10, complaints: 0, field: 0 } }),
        entry({ id: "revenue", serviceId: 2, opening: { service: 4, complaints: 0, field: 0 } }),
        entry({ id: "fieldwork", serviceId: 8, opening: { service: 6, complaints: 0, field: 0 } }),
      ],
    );
    await renderDashboard();
    const table = await openRegister();
    const opening = headers(table).indexOf("Opening Pending");
    expect(opening).toBeGreaterThan(-1);
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    const cellsOf = (i: number) => Array.from(bodyRows[i].querySelectorAll("td"));
    expect(cellsOf(0)[opening].textContent).toBe("10"); // service 1, counter
    expect(cellsOf(1)[opening].textContent).toBe(""); // service 2, revenue
    expect(cellsOf(2)[opening].textContent).toBe(""); // service 8, field work
  });

  it("drops the six register columns for fields the form no longer collects", async () => {
    mockApi([row()], [entry()]);
    await renderDashboard();
    const table = await openRegister();
    for (const gone of [
      "SLA Within Time",
      "Avg Days",
      "Complaints Received",
      "Complaints Resolved",
      "Field Received",
      "Field Completed",
    ])
      expect(headers(table)).not.toContain(gone);
  });

  it("no longer labels one column as requests or transactions", async () => {
    mockApi([row()]);
    await renderDashboard();
    const table = labelledTable(/anchal-wise performance table/i);
    expect(headers(table)).not.toContain("Requests / Transactions");
    expect(headers(table)).not.toContain("Disposed / Completed");
  });

  it("keeps the correction history labels for the retired fields", async () => {
    // audit.ts is unchanged: a pre-cutover entry keeps its stored complaint, field
    // and SLA figures, and a correction to one must still render with a label.
    for (const key of [
      "slaWithinTime",
      "complaintsReceived",
      "complaintsResolved",
      "fieldReceived",
      "fieldCompleted",
      "avgDisposalDays",
    ]) {
      expect(auditFields[key]?.[0]).toBeTruthy();
      expect(auditFields[key]?.[1]).toBeTruthy();
    }
    expect(
      auditComparison(
        '{"complaintsReceived":3,"complaintsResolved":1}',
        '{"complaintsReceived":4,"complaintsResolved":1}',
      ).changes,
    ).toEqual([{ key: "complaintsReceived", before: 3, after: 4 }]);
  });

  it("states the date the form changed", async () => {
    mockApi([row()]);
    await renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByText(
          "Form fields were reduced on 20 November 2026 — figures before and after this date are not comparable.",
        ),
      ).toBeTruthy(),
    );
    cleanup();
    mockApi([row()]);
    await renderDashboard("hi");
    expect(
      screen.getByText(
        "फॉर्म के फ़ील्ड 20 नवंबर 2026 को कम किए गए — इस तिथि से पहले और बाद के आंकड़े तुलनीय नहीं हैं।",
      ),
    ).toBeTruthy();
  });
});
