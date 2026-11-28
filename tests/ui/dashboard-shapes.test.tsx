// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import Dashboard from "../../src/client/pages/Dashboard";
import { auditComparison, auditFields } from "../../src/client/audit";
import { FIELD_WORK_IDS, OFFERED_IDS } from "./service-position";
import type { MonitoringRow } from "../../src/shared/types";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

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

function mockApi(rows: MonitoringRow[]) {
  api.mockImplementation(async () => ({ rows, updatedAt: "2026-11-20T05:00:00.000Z" }));
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

function headers(table: HTMLElement) {
  return Array.from(table.querySelectorAll("thead th")).map((th) =>
    (th.textContent ?? "").trim(),
  );
}

beforeEach(() => {
  cleanup();
  api.mockReset();
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

  it("has no work-done tile, in either language", async () => {
    // The clerk no longer reports field work, so the figure would read zero from
    // the cutover, and on this page a zero says "no work was done". The row still
    // carries workDone (the server computes it), so 22 must not reach the screen.
    mockApi([row({ workDone: 18 }), row({ officeId: 2, workDone: 4 })]);
    await renderDashboard();
    expect(screen.queryByText("Work done this period")).toBeNull();
    expect(document.querySelectorAll("[data-metric]")).toHaveLength(3);
    expect(screen.queryByText(/field-work service/)).toBeNull();
    expect(screen.queryByText("Field work completed")).toBeNull();
    cleanup();
    mockApi([row({ workDone: 18 })]);
    await renderDashboard("hi");
    expect(screen.queryByText("इस अवधि में किया गया कार्य")).toBeNull();
    expect(document.querySelectorAll("[data-metric]")).toHaveLength(3);
    expect(screen.queryByText(/क्षेत्रीय कार्य सेवा/)).toBeNull();
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

  it("has no work-done column, in either language, and keeps the other six", async () => {
    mockApi([row({ workDone: 18 }), row({ officeId: 2, workDone: 4 })]);
    await renderDashboard();
    const table = labelledTable(/anchal-wise performance table/i);
    expect(headers(table)).toEqual([
      "Anchal",
      "Received",
      "Completed",
      "Pending",
      "Disposal %",
      "Amount Collected (₹)",
    ]);
    // Every row and the totals row have one cell per remaining header, and none
    // of them carries the work-done figures (18, 4 or their total 22).
    for (const tr of Array.from(table.querySelectorAll("tbody tr, tfoot tr")))
      expect(tr.querySelectorAll("td")).toHaveLength(6);
    const text = (table.textContent ?? "").replace(/₹[\d,.]+/g, "");
    for (const gone of ["18", "22"]) expect(text, gone).not.toContain(gone);
    expect(Array.from(table.querySelectorAll("td")).map((td) => td.getAttribute("data-label"))).not.toContain("Work done");
    cleanup();
    mockApi([row()]);
    await renderDashboard("hi");
    const hi = labelledTable(/अंचलवार प्रदर्शन तालिका/i);
    expect(headers(hi)).toEqual(["अंचल", "प्राप्त", "पूर्ण", "लंबित", "निस्तारण %", "संग्रहित राशि (₹)"]);
    expect(headers(hi)).not.toContain("किया गया कार्य");
    expect(hi.querySelectorAll("tfoot td")).toHaveLength(6);
  });

  it("blanks the counter-only cells when filtered to a non-counter service", async () => {
    // Pinned to field work or revenue, Received / Completed / Pending /
    // Disposal are not collected at all. A zero would read as "nobody did
    // anything", which is a different and untrue statement — the same reason
    // the register leaves Opening Pending blank for these shapes.
    mockApi([row({ received: 0, completed: 0, pending: 0, disposalPct: null })]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "2"); // revenue
    const table = labelledTable(/anchal-wise performance table/i);
    const index = (name: string) => headers(table).indexOf(name);
    const bodyCell = (name: string) =>
      Array.from(
        Array.from(table.querySelectorAll("tbody tr"))[0].querySelectorAll("td"),
      )[index(name)].textContent;
    const footCell = (name: string) =>
      Array.from(table.querySelectorAll("tfoot td"))[index(name)].textContent;
    await waitFor(() => expect(bodyCell("Received")).toBe(""));
    for (const blank of ["Received", "Completed", "Pending", "Disposal %"]) {
      expect(bodyCell(blank), `${blank} body cell`).toBe("");
      expect(footCell(blank), `${blank} total`).toBe("");
    }
    // What the service does collect still shows: a revenue service takes money.
    expect(bodyCell("Amount Collected (₹)")).toBe("₹2,500.00");
  });

  it("blanks a tile whose figure the pinned service does not collect", async () => {
    // One row above the table, the same reading: Total pending 0 and Disposal —
    // for a revenue service, Amount Collected ₹0.00 for anything but revenue.
    const tile = (label: string) => {
      const found = screen.getByText(label).closest("[data-metric]") as HTMLElement;
      return {
        value: found.querySelector("strong")!.textContent,
        note: found.querySelector("small")!.textContent,
      };
    };
    mockApi([row()]);
    await renderDashboard();
    const user = userEvent.setup();
    const pin = (id: string) =>
      user.selectOptions(screen.getByLabelText("Service", { exact: true }), id);

    // Unpinned, every tile is a cross-service total and every one means something.
    expect(tile("Total pending").value).toBe("12");
    expect(tile("Disposal").value).toBe("75.0%");
    expect(tile("Total collection").value).toBe("₹2,500.00");

    await pin("2"); // revenue
    await waitFor(() => expect(tile("Total pending").value).toBe(""));
    expect(tile("Total collection").value).toBe("₹2,500.00");
    expect(tile("Disposal").value).toBe("");
    expect(tile("Disposal").note, "the ratio behind it goes too").toBe("");

    // A plain counter service. This was service 1 until it began to collect an
    // amount: it is now a counterRevenue service, for which "Total collection"
    // is not blank, so it can no longer stand for "a counter service here".
    await pin("11"); // counter
    await waitFor(() => expect(tile("Total pending").value).toBe("12"));
    expect(tile("Disposal").value).toBe("75.0%");
    expect(tile("Disposal").note).toBe("30 / 40");
    expect(tile("Total collection").value).toBe("");
  });

  it("keeps the counter cells when filtered to a counter service", async () => {
    mockApi([row()]);
    await renderDashboard();
    const user = userEvent.setup();
    // Service 11, not 1: see the pin above. Service 1 is pinned in Task 4's test.
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "11");
    const table = labelledTable(/anchal-wise performance table/i);
    const column = headers(table).indexOf("Received");
    await waitFor(() =>
      expect(
        Array.from(
          Array.from(table.querySelectorAll("tbody tr"))[0].querySelectorAll("td"),
        )[column].textContent,
      ).toBe("40"),
    );
  });

  // The helpers below read the tiles and the table the way the tests above do.
  const tileOf = (label: string) => {
    const found = screen.getByText(label).closest("[data-metric]") as HTMLElement;
    return {
      value: found.querySelector("strong")!.textContent,
      note: found.querySelector("small")!.textContent,
    };
  };
  const cellsOf = (name: string) => {
    const table = labelledTable(/anchal-wise performance table/i);
    const column = headers(table).indexOf(name);
    return {
      body: Array.from(table.querySelectorAll("tbody tr")).map(
        (tr) => Array.from(tr.querySelectorAll("td"))[column].textContent,
      ),
      foot: Array.from(table.querySelectorAll("tfoot td"))[column].textContent,
    };
  };

  it.each(["1", "3", "4", "7"])(
    "shows pending, disposal and collection when pinned to service %s, which collects a queue and money",
    async (id) => {
      mockApi([row()]);
      await renderDashboard();
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("Service", { exact: true }), id);
      await waitFor(() => expect(tileOf("Total pending").value).toBe("12"));
      expect(tileOf("Disposal").value).toBe("75.0%");
      expect(tileOf("Disposal").note).toBe("30 / 40");
      expect(tileOf("Total collection").value).toBe("₹2,500.00");
      // The table agrees with the tiles: every column the service collects.
      for (const [name, shown] of [
        ["Received", "40"],
        ["Completed", "30"],
        ["Pending", "12"],
        ["Disposal %", "75.0%"],
        ["Amount Collected (₹)", "₹2,500.00"],
      ] as const) {
        expect(cellsOf(name).body, `${name} body`).toEqual([shown]);
        expect(cellsOf(name).foot, `${name} total`).toBe(shown);
      }
    },
  );

  it("leaves the collection blank, not zero, for a counter service that takes no money", async () => {
    // The distinction the page's own comment names: a zero says "no money was
    // collected", a blank says "this service collects none". The row carries a
    // real zero so a cell that merely printed its data would read ₹0.00.
    mockApi([row({ amountPaise: 0 })]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "11");
    await waitFor(() => expect(tileOf("Total collection").value).toBe(""));
    expect(tileOf("Total collection").value).not.toBe("₹0.00");
    expect(cellsOf("Amount Collected (₹)").body).toEqual([""]);
    expect(cellsOf("Amount Collected (₹)").foot).toBe("");
    // A queue service that does collect money shows a real zero as a zero.
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "1");
    await waitFor(() => expect(tileOf("Total collection").value).toBe("₹0.00"));
    expect(cellsOf("Amount Collected (₹)").body).toEqual(["₹0.00"]);
  });

  it("leaves pending blank when pinned to a revenue service", async () => {
    mockApi([row({ pending: 0 })]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "2");
    await waitFor(() => expect(tileOf("Total collection").value).toBe("₹2,500.00"));
    expect(tileOf("Total pending").value).toBe("");
    expect(cellsOf("Pending").body).toEqual([""]);
    expect(cellsOf("Pending").foot).toBe("");
    expect(cellsOf("Amount Collected (₹)").body).toEqual(["₹2,500.00"]);
  });

  it("leaves the unpinned table unchanged", async () => {
    mockApi([row()]);
    await renderDashboard();
    expect(cellsOf("Received").body).toEqual(["40"]);
    expect(cellsOf("Pending").body).toEqual(["12"]);
    expect(cellsOf("Amount Collected (₹)").body).toEqual(["₹2,500.00"]);
    expect(cellsOf("Amount Collected (₹)").foot).toBe("₹2,500.00");
  });

  describe("the notes under the tiles count the services that feed the figure", () => {
    // The ten offered services by what they carry: a queue on 1, 3, 4, 7, 11, 12
    // and 24 (seven); an amount on 1, 3, 4, 7 and the collections 2, 5, 6 (seven).
    // A note that counted one shape would say 3 and 3 where the figure spans 7.
    it("counts counter and counterRevenue services under pending, revenue and counterRevenue under collection", async () => {
      mockApi([row()]);
      await renderDashboard();
      expect(tileOf("Total pending").note).toBe("across 7 services with a pending balance");
      expect(tileOf("Total collection").note).toBe("across 7 services that collect an amount");
    });

    it("says it in Hindi with the plural the count needs", async () => {
      mockApi([row()]);
      await renderDashboard("hi");
      expect(tileOf("कुल लंबित").note).toBe("लंबित शेष वाली 7 सेवाओं में");
      expect(tileOf("कुल संग्रह").note).toBe("राशि संग्रहित करने वाली 7 सेवाओं में");
    });

    it("falls back to what the figure is once a service is pinned", async () => {
      mockApi([row()]);
      await renderDashboard();
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "1");
      await waitFor(() => expect(tileOf("Total pending").note).toBe("Closing balance"));
      expect(tileOf("Total collection").note).toBe("Actual collection");
    });
  });
});

describe("the dashboard once the daily entry no longer collects field work", () => {
  const serviceSelect = () => screen.getByLabelText("Service", { exact: true }) as HTMLSelectElement;
  const optionIds = () =>
    Array.from(serviceSelect().options)
      .map((o) => o.value)
      .filter((v) => v !== "")
      .map(Number);

  it("offers the ten the daily entry collects, in the service master's order, and none of the eight", async () => {
    mockApi([row()]);
    await renderDashboard();
    // Compared with a hand-written list (service-position.ts), never with the
    // implementation's own predicate, so a filter and a predicate that drifted
    // together would still be caught.
    expect(optionIds()).toEqual([...OFFERED_IDS].sort((a, b) => a - b));
    expect(optionIds()).toHaveLength(10);
    for (const id of FIELD_WORK_IDS) expect(optionIds(), `service ${id}`).not.toContain(id);
  });

  it("names the count it offers, in both languages", async () => {
    mockApi([row()]);
    await renderDashboard();
    expect(within(serviceSelect()).getByRole("option", { name: "All 10 services" })).toBeTruthy();
    expect(screen.queryByText("All 25 services")).toBeNull();
    cleanup();
    mockApi([row()]);
    await renderDashboard("hi");
    const hi = screen.getByLabelText("सेवा", { exact: true }) as HTMLSelectElement;
    expect(within(hi).getByRole("option", { name: "सभी 10 सेवाएँ" })).toBeTruthy();
    expect(within(hi).queryByRole("option", { name: "सभी 25 सेवाएँ" })).toBeNull();
  });

  it("shows the server's filed count as it comes, over a range that spans the cutover", async () => {
    // Before the cutover Anchal 1 filed field-work entries as well; after it,
    // none. The server counts only the services the entry collects, so over four
    // days (10 a day = 40) an office that filed everything reads 40 / 40, and an
    // office with three services missing reads 37 / 40. The page repeats those
    // figures: it neither recomputes them nor lets the stored workDone (a sum
    // across the cutover that mixes the two regimes) onto the screen.
    mockApi([
      row({ officeId: 1, submitted: 40, expected: 40, workDone: 31 }),
      row({ officeId: 2, submitted: 37, expected: 40, workDone: 0 }),
      row({ officeId: 3, submitted: 0, expected: 40, workDone: 0 }),
    ]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("View", { exact: true }), "range");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-01-01" } });
    await waitFor(() => expect(api.mock.calls.some((c) => String(c[0]).includes("from=2026-01-01"))).toBe(true));
    const filed = screen.getByRole("heading", { name: "Filing status" }).closest("section")!;
    const item = (n: number) => within(filed).getByText(`Anchal ${n}`).closest("li")!;
    await waitFor(() => expect(item(1).textContent).toContain("40 / 40"));
    expect(item(1).textContent).toContain("Filed");
    expect(item(2).textContent).toContain("37 / 40");
    expect(item(2).textContent).toContain("Partly filed");
    expect(item(3).textContent).toContain("Not filed");
    expect(screen.getByText(/77 \/ 120/).closest("[data-report-count]")).not.toBeNull();
    // 31 is Anchal 1's pre-cutover field work. Nowhere on the page.
    expect(document.body.textContent).not.toMatch(/\b31\b/);
    expect(screen.queryByText("Work done")).toBeNull();
    // The request carries no per-service restriction a stale field could add.
    expect(api.mock.calls.every((c) => !String(c[0]).includes("serviceId"))).toBe(true);
  });

  it("does not throw on a spanning range whose rows carry only field-work history", async () => {
    // A range wholly before the cutover, pinned nowhere: all the figures are
    // historical field work, workDone large, the queue figures zero. Whatever the
    // server sends, the page renders its six columns and the three tiles.
    mockApi([row({ received: 0, completed: 0, pending: 0, disposalPct: null, amountPaise: 0, workDone: 412, submitted: 0, expected: 34 })]);
    await renderDashboard();
    const table = labelledTable(/anchal-wise performance table/i);
    expect(table.querySelectorAll("tbody td")).toHaveLength(6);
    expect(document.body.textContent).not.toContain("412");
  });

  it("reads an office whose only unfiled services were field work as fully filed", async () => {
    // Anchal 1 filed all ten collected services and none of the eight. With
    // a denominator of 25 that read 10 / 25, "Partly filed"; the server now
    // expects 10, so the row arrives as 10 / 10.
    mockApi([row({ officeId: 1, submitted: 10, expected: 10, workDone: 0 })]);
    await renderDashboard();
    const filed = screen.getByRole("heading", { name: "Filed today" }).closest("section")!;
    const item = within(filed).getByText("Anchal 1").closest("li")!;
    expect(item.textContent).toContain("10 / 10");
    expect(item.textContent).toContain("Filed");
    expect(item.textContent).not.toContain("Partly filed");
    expect(item.textContent).not.toContain("Not filed");
    expect(document.querySelector("[data-report-count]")!.textContent).toContain("10 / 10");
    cleanup();
    mockApi([row({ officeId: 1, submitted: 10, expected: 10, workDone: 0 })]);
    await renderDashboard("hi");
    const filedHi = screen.getByRole("heading", { name: "आज दर्ज" }).closest("section")!;
    const itemHi = within(filedHi).getByText("अंचल 1").closest("li")!;
    expect(itemHi.textContent).toContain("10 / 10");
    expect(itemHi.textContent).not.toContain("आंशिक दर्ज");
  });
});
