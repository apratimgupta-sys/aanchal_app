// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { Language } from "../../src/client/i18n";
import Dashboard from "../../src/client/pages/Dashboard";
import type { EntryView, MonitoringRow } from "../../src/shared/types";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const row = (o: Partial<MonitoringRow> = {}): MonitoringRow => ({
  officeId: 1, received: 40, completed: 30, slaWithinTime: 0, pending: 12, disposalPct: 75, slaPct: null,
  amountPaise: 250000, complaintsPending: 0, fieldPending: 0, workDone: 18, submitted: 25, expected: 25,
  configured: true, reviewReasons: [], ...o,
});
const entry = {
  id: "e1", officeId: 1, version: 1, serviceId: 1, serviceDate: "2026-11-19", reportingDate: "2026-11-19", ward: "12",
  received: 9, completed: 7, slaWithinTime: 0, amountPaise: 0, complaintsReceived: 0, complaintsResolved: 0,
  fieldReceived: 0, fieldCompleted: 0, avgDisposalDays: 0, remarks: "", nothingToReport: false,
  createdAt: "2026-11-19T05:00:00.000Z", updatedAt: "2026-11-19T05:00:00.000Z",
  opening: { service: 10, complaints: 0, field: 0 }, closing: { service: 12, complaints: 0, field: 0 },
} as EntryView;

async function renderDashboard(rows: MonitoringRow[], lang: "en" | "hi" = "en", extra: Record<string, unknown> = {}) {
  api.mockImplementation(async (path: string) =>
    path.startsWith("/dashboard/entries") ? [entry] : { rows, updatedAt: "2026-11-20T05:00:00.000Z", ...extra },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}><Dashboard /></Language.Provider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0));
}

beforeEach(() => { cleanup(); api.mockReset(); });
afterEach(() => cleanup());

describe("dashboard layout order and structure", () => {
  it("who has filed today is the first thing on the page", async () => {
    await renderDashboard([row()]);
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toMatch(/Filed today/);
    cleanup();
    await renderDashboard([row()], "hi");
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toMatch(/आज दर्ज/);
  });

  it("puts filing status, then the figures, then the Anchal table, then the register", async () => {
    await renderDashboard([row()]);
    await userEvent.setup().click(screen.getByRole("button", { name: /view service entries/i }));
    await screen.findByText(/service entry register/i);
    const order = ["Filed today", "Total pending", "Anchal-wise performance", "Service entry register"].map(
      (text) => screen.getByText(text),
    );
    for (let i = 1; i < order.length; i++)
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, order[i].textContent!).toBeTruthy();
  });

  it("says, per Anchal, whether it has filed - with words, not colour alone", async () => {
    await renderDashboard([
      row({ officeId: 1, submitted: 25, expected: 25 }),
      row({ officeId: 2, submitted: 10, expected: 25 }),
      row({ officeId: 3, submitted: 0, expected: 25 }),
      row({ officeId: 4, submitted: 0, expected: 0, configured: false }),
    ]);
    const filed = screen.getByRole("heading", { name: "Filed today" }).closest("section")!;
    const item = (n: number) => within(filed).getByText(`Anchal ${n}`).closest("li")!;
    expect(item(1).textContent).toContain("Filed");
    expect(item(1).textContent).not.toContain("Partly");
    expect(item(2).textContent).toContain("Partly filed");
    expect(item(2).textContent).toContain("10 / 25");
    expect(item(3).textContent).toContain("Not filed");
    expect(item(4).textContent).toContain("Not set up");
  });

  it("does not call a past period 'today'", async () => {
    await renderDashboard([row()]);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("View"), "range");
    await user.clear(screen.getByLabelText("From date"));
    await user.type(screen.getByLabelText("From date"), "2026-11-01");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Filed today" })).toBeNull());
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toMatch(/Filing status/);
  });

  it("a figure with no reading time does not render an invalid date", async () => {
    await renderDashboard([row()], "en", { updatedAt: null });
    expect(document.body.textContent).not.toMatch(/Invalid Date/);
    expect(screen.queryByText(/Figures as of/)).toBeNull();
  });

  it("each wide table scrolls inside its own container", async () => {
    await renderDashboard([row()]);
    await userEvent.setup().click(screen.getByRole("button", { name: /view service entries/i }));
    await screen.findByText(/service entry register/i);
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);
    for (const table of tables) expect(table.closest("[data-scroll-x]")).not.toBeNull();
  });

  it("keeps every column reachable below lg: each cell names itself", async () => {
    await renderDashboard([row()]);
    const table = screen.getAllByRole("table")[0];
    const heads = Array.from(table.querySelectorAll("thead th")).map((h) => h.textContent);
    const cells = Array.from(table.querySelectorAll("tbody tr:first-child td")).map((c) => c.getAttribute("data-label"));
    expect(cells).toEqual(heads);
  });

  it("puts the period and service filters above the filing status", async () => {
    await renderDashboard([row()]);
    const filters = screen.getByLabelText("Service", { exact: true });
    const filed = screen.getByText("Filed today");
    expect(filters.compareDocumentPosition(filed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("names the reason in the last column, not a count", async () => {
    await renderDashboard([
      row({ officeId: 1, reviewReasons: ["Pending > 10"] }),
      row({ officeId: 2, reviewReasons: ["Pending > 10", "Disposal < 90%"] }),
      row({ officeId: 3, submitted: 0, expected: 25 }),
    ]);
    const table = screen.getAllByRole("table")[0];
    const cells = Array.from(table.querySelectorAll("tbody tr")).map((tr) => tr.lastElementChild!.textContent);
    expect(cells[0]).toContain("Pending > 10");
    expect(cells[1]).toContain("Pending > 10 +1 more");
    expect(cells[2]).toContain("Nothing filed today");
    expect(document.body.textContent).not.toMatch(/REVIEW \(/);
  });

  it("says what each tile spans", async () => {
    await renderDashboard([row()]);
    expect(screen.getByText(/^across \d+ counter services$/)).toBeTruthy();
    expect(screen.getByText(/^across \d+ revenue services$/)).toBeTruthy();
  });

  it("renders no second <main> landmark", async () => {
    await renderDashboard([row()]);
    expect(document.querySelectorAll("main, #main-content")).toHaveLength(0);
  });
});

describe("Dashboard source", () => {
  const src = readFileSync("src/client/pages/Dashboard.tsx", "utf8");
  it("no longer imports the frozen legacy component set", () => {
    expect(src).not.toMatch(/legacy-ui/);
    expect(src).toMatch(/from "\.\.\/ui"/);
  });
  it("uses no class name from the old stylesheets", () => {
    expect(src).not.toMatch(/ux4g-|className="[^"]*(?<![\w:-])(panel|metric|metrics|table-wrap|monitoring-table|details-panel|details-trigger|section-heading|page-heading|status-tag|report-count|review-cell|nowrap|eyebrow)(?![\w-])/);
  });
});
