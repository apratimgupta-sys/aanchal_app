// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnchalSection from "../../src/client/pages/dashboard/AnchalSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import services from "../../src/shared/services.json";
import { anchalRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const table = () => screen.getByRole("table");
const head = () => Array.from(table().querySelectorAll("thead th")).map((th) => th.textContent!.trim());
const cells = (row: Element) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent!.trim());
const bodyRows = () => Array.from(table().querySelectorAll("tbody tr"));
const totalRow = () => table().querySelector("tfoot tr")!;
const lastPath = () => paths(api, "/dashboard?").at(-1);

async function shown(lang: "en" | "hi" = "en", onStamp?: (stamp: string) => void) {
  renderWithin(<AnchalSection onStamp={onStamp} />, lang);
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
}

beforeEach(() => {
  api.mockReset();
});
afterEach(() => cleanup());

describe("the Anchal-wise performance section", () => {
  it("shows what each Anchal received, disposed, has pending and collected, and the total", async () => {
    route(api, { anchals: [anchalRow(), anchalRow({ officeId: 2, received: 10, completed: 5, pending: 3, disposalPct: 50, amountPaise: 100000 })] });
    await shown();

    expect(screen.getByRole("heading", { level: 2, name: "Anchal-wise performance" })).toBeTruthy();
    expect(head()).toEqual(["Anchal", "Received", "Disposed", "Pending", "Disposal %", "Collected (₹)"]);
    expect(cells(bodyRows()[0])).toEqual(["Anchal 1", "40", "30", "12", "75.0%", "₹2,500.00"]);
    expect(cells(bodyRows()[1])).toEqual(["Anchal 2", "10", "5", "3", "50.0%", "₹1,000.00"]);
    expect(cells(totalRow())).toEqual(["TOTAL", "50", "35", "15", "70.0%", "₹3,500.00"]);
  });

  it("says it in Hindi", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown("hi");

    expect(screen.getByRole("heading", { level: 2, name: "अंचलवार प्रदर्शन" })).toBeTruthy();
    expect(head()).toEqual(["अंचल", "प्राप्त", "निस्तारित", "लंबित", "निस्तारण %", "संग्रहित (₹)"]);
    expect(cells(bodyRows()[0])[0]).toBe("अंचल 1");
    expect(cells(totalRow())[0]).toBe("कुल");
  });

  it("asks for today first, and for the period chosen after that", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    expect(paths(api, "/dashboard?")[0]).toBe(`/dashboard?from=${today}&to=${today}`);

    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${addDays(today, -6)}&to=${today}`));

    await userEvent.setup().click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${today.slice(0, 8)}01&to=${today}`));
  });

  it("offers the ten daily services in the entry form's order and numbering, and pins to the one chosen", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    const select = screen.getByLabelText("Service") as HTMLSelectElement;
    const name = (id: number) => services.find((s) => s.id === id)!.en;

    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 10 services",
      ...OFFERED_IDS.map((id) => `${servicePosition(id)} · ${name(id)}`),
    ]);

    await userEvent.setup().selectOptions(select, "11");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${today}&to=${today}&serviceId=11`));
  });

  // Blank means the service does not record the figure; zero means nothing happened.
  it.each([
    ["a collection, which keeps no queue", "2", ["Anchal 1", "", "", "", "", "₹2,500.00"]],
    ["a queue that takes no money", "11", ["Anchal 1", "40", "30", "12", "75.0%", ""]],
    ["a queue that also takes a fee", "1", ["Anchal 1", "40", "30", "12", "75.0%", "₹2,500.00"]],
  ])("pinned to %s, leaves blank what that service does not record", async (_, serviceId, expected) => {
    route(api, { anchals: [anchalRow()] });
    await shown();

    await userEvent.setup().selectOptions(screen.getByLabelText("Service"), serviceId);
    await waitFor(() => expect(lastPath()).toContain(`serviceId=${serviceId}`));

    await waitFor(() => expect(cells(bodyRows()[0])).toEqual(expected));
    expect(cells(totalRow()).slice(1)).toEqual(expected.slice(1));
  });

  it("asks for nothing while the custom period cannot be asked for, and says why once both dates are in", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    await userEvent.setup().click(screen.getByRole("button", { name: "Custom" }));
    const asked = api.mock.calls.length;

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: addDays(today, -5) } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: addDays(today, -10) } });

    expect(screen.getByRole("alert").textContent).toBe("Start date must be on or before the end date.");
    expect(api.mock.calls.length).toBe(asked);

    fireEvent.change(screen.getByLabelText("To date"), { target: { value: addDays(today, -1) } });
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${addDays(today, -5)}&to=${addDays(today, -1)}`));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["en", "Invalid reporting filters"],
    ["hi", "रिपोर्टिंग फ़िल्टर गलत हैं"],
  ] as const)("shows the server's refusal inside its own card (%s)", async (lang, message) => {
    api.mockRejectedValue(new Error("Invalid reporting filters"));
    renderWithin(<AnchalSection />, lang);

    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("carries nothing about filing", async () => {
    route(api, { anchals: [anchalRow({ submitted: 7, expected: 10 })] });
    await shown();

    expect(document.body.textContent).not.toMatch(/filed|reports|7 \/ 10/i);
  });

  it("passes the time of its figures upward", async () => {
    const onStamp = vi.fn();
    route(api, { anchals: [anchalRow()], updatedAt: "2026-11-20T05:00:00.000Z" });
    await shown("en", onStamp);

    await waitFor(() => expect(onStamp).toHaveBeenLastCalledWith("2026-11-20T05:00:00.000Z"));
  });
});
