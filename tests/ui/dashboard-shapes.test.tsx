// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import Dashboard from "../../src/client/pages/Dashboard";
import { auditComparison, auditFields } from "../../src/client/audit";
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

  it("shows work done for the period", async () => {
    mockApi([row({ workDone: 18 }), row({ officeId: 2, workDone: 4 })]);
    await renderDashboard();
    const tile = screen.getByText("Work done this period").closest("[data-metric]");
    expect(tile).not.toBeNull();
    expect(within(tile as HTMLElement).getByText("22")).toBeTruthy();
    cleanup();
    mockApi([row({ workDone: 18 })]);
    await renderDashboard("hi");
    expect(screen.getByText("इस अवधि में किया गया कार्य")).toBeTruthy();
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

  it("gives field work a column of its own, with a total", async () => {
    // workDone is on every row already; without a column the commissioner can
    // only see it summed across all six Anchals, and cannot compare them.
    mockApi([row({ workDone: 18 }), row({ officeId: 2, workDone: 4 })]);
    await renderDashboard();
    const table = labelledTable(/anchal-wise performance table/i);
    expect(headers(table)).toContain("Work done");
    const column = headers(table).indexOf("Work done");
    const cells = Array.from(table.querySelectorAll("tbody tr")).map(
      (tr) => Array.from(tr.querySelectorAll("td"))[column].textContent,
    );
    expect(cells).toEqual(["18", "4"]);
    expect(
      Array.from(table.querySelectorAll("tfoot td"))[column].textContent,
    ).toBe("22");
    cleanup();
    mockApi([row()]);
    await renderDashboard("hi");
    expect(
      headers(labelledTable(/अंचलवार प्रदर्शन तालिका/i)),
    ).toContain("किया गया कार्य");
  });

  it("blanks the counter-only cells when filtered to a non-counter service", async () => {
    // Pinned to field work or revenue, Received / Completed / Pending /
    // Disposal are not collected at all. A zero would read as "nobody did
    // anything", which is a different and untrue statement — the same reason
    // the register leaves Opening Pending blank for these shapes.
    mockApi([row({ received: 0, completed: 0, pending: 0, disposalPct: null, workDone: 18 })]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "8");
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
    // What the service does collect still shows. Field work collects no money,
    // so its amount is blank too (see the field-work amount test below).
    expect(bodyCell("Work done")).toBe("18");
  });

  it("blanks the work done column when the filter pins a service that is not field work", async () => {
    // The inverse of the ruling above, and the same misreading: a 0 here says
    // no field work was done, when field work is not collected for a counter
    // or revenue service at all.
    mockApi([row({ workDone: 0 })]);
    await renderDashboard();
    const user = userEvent.setup();
    const table = labelledTable(/anchal-wise performance table/i);
    const column = () => headers(table).indexOf("Work done");
    const body = () =>
      Array.from(
        Array.from(table.querySelectorAll("tbody tr"))[0].querySelectorAll("td"),
      )[column()].textContent;
    const foot = () =>
      Array.from(table.querySelectorAll("tfoot td"))[column()].textContent;

    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "1");
    await waitFor(() => expect(body()).toBe(""));
    expect(foot(), "the total too").toBe("");

    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "2");
    await waitFor(() => expect(body()).toBe(""));

    // Pinned to field work it is the one figure that means something.
    cleanup();
    mockApi([row({ workDone: 7 })]);
    await renderDashboard();
    const user2 = userEvent.setup();
    await user2.selectOptions(screen.getByLabelText("Service", { exact: true }), "8");
    const table2 = labelledTable(/anchal-wise performance table/i);
    const index = headers(table2).indexOf("Work done");
    await waitFor(() =>
      expect(
        Array.from(
          Array.from(table2.querySelectorAll("tbody tr"))[0].querySelectorAll("td"),
        )[index].textContent,
      ).toBe("7"),
    );
  });

  it("blanks a tile whose figure the pinned service does not collect", async () => {
    // One row above the table, the same reading: Total pending 0 and Disposal —
    // for a field-work service, Amount Collected ₹0.00 for anything but revenue.
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
    expect(tile("Work done this period").value).toBe("18");

    await pin("8"); // field work
    await waitFor(() => expect(tile("Total pending").value).toBe(""));
    expect(tile("Disposal").value).toBe("");
    expect(tile("Disposal").note, "the ratio behind it goes too").toBe("");
    expect(tile("Total collection").value).toBe("");
    expect(tile("Work done this period").value).toBe("18");

    await pin("2"); // revenue
    await waitFor(() => expect(tile("Total collection").value).toBe("₹2,500.00"));
    expect(tile("Total pending").value).toBe("");
    expect(tile("Disposal").value).toBe("");
    expect(tile("Work done this period").value).toBe("");

    // A plain counter service. This was service 1 until it began to collect an
    // amount: it is now a counterRevenue service, for which "Total collection"
    // is not blank, so it can no longer stand for "a counter service here".
    await pin("11"); // counter
    await waitFor(() => expect(tile("Total pending").value).toBe("12"));
    expect(tile("Disposal").value).toBe("75.0%");
    expect(tile("Disposal").note).toBe("30 / 40");
    expect(tile("Total collection").value).toBe("");
    expect(tile("Work done this period").value).toBe("");
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
      await waitFor(() => expect(tileOf("Work done this period").value).toBe(""));
      expect(tileOf("Total pending").value).toBe("12");
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
      // Field work is the one thing it does not collect.
      expect(cellsOf("Work done").body).toEqual([""]);
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

  it("leaves the amount blank when pinned to field work, which collects no money", async () => {
    mockApi([row({ amountPaise: 0 })]);
    await renderDashboard();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Service", { exact: true }), "8");
    await waitFor(() => expect(cellsOf("Amount Collected (₹)").body).toEqual([""]));
    expect(cellsOf("Amount Collected (₹)").foot).toBe("");
  });

  it("leaves the unpinned table unchanged", async () => {
    mockApi([row()]);
    await renderDashboard();
    expect(cellsOf("Received").body).toEqual(["40"]);
    expect(cellsOf("Pending").body).toEqual(["12"]);
    expect(cellsOf("Work done").body).toEqual(["18"]);
    expect(cellsOf("Amount Collected (₹)").body).toEqual(["₹2,500.00"]);
    expect(cellsOf("Amount Collected (₹)").foot).toBe("₹2,500.00");
  });

  describe("the notes under the tiles count the services that feed the figure", () => {
    // Service ids by shape: counter 11, 12 and 18-25 (ten); counterRevenue 1, 3,
    // 4, 7; revenue 2, 5, 6; field work 8-10 and 13-17 (eight). A note that
    // counted one shape would say 10 and 3 where the figure spans 14 and 7.
    it("counts counter and counterRevenue services under pending, revenue and counterRevenue under collection", async () => {
      mockApi([row()]);
      await renderDashboard();
      expect(tileOf("Total pending").note).toBe("across 14 services with a pending balance");
      expect(tileOf("Total collection").note).toBe("across 7 services that collect an amount");
      expect(tileOf("Work done this period").note).toBe("across 8 field-work services");
    });

    it("says it in Hindi with the plural the count needs", async () => {
      mockApi([row()]);
      await renderDashboard("hi");
      expect(tileOf("कुल लंबित").note).toBe("लंबित शेष वाली 14 सेवाओं में");
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
