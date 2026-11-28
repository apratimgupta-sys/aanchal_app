// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceSection from "../../src/client/pages/dashboard/ServiceSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import services from "../../src/shared/services.json";
import { paths, renderWithin, route, serviceRow } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const name = (id: number, lang: "en" | "hi" = "en") => { const s = services.find((x) => x.id === id)!; return lang === "hi" ? s.name : s.en; };
const table = () => screen.getByRole("table");
const head = () => Array.from(table().querySelectorAll("thead th")).map((th) => th.textContent!.trim());
const cells = (row: Element) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent!.trim());
const bodyRows = () => Array.from(table().querySelectorAll("tbody tr"));
const rowOf = (id: number) => bodyRows()[OFFERED_IDS.indexOf(id)];
const totalRow = () => table().querySelector("tfoot tr")!;

// One of each kind carries figures; the other seven are at zero.
const figures = OFFERED_IDS.map((id) =>
  id === 1 ? serviceRow(1, { received: 64, completed: 52, pending: 412, disposalPct: 81.25, amountPaise: 12800000 })
  : id === 11 ? serviceRow(11, { received: 121, completed: 118, pending: 206, disposalPct: 97.52 })
  : id === 2 ? serviceRow(2, { received: 212, amountPaise: 76430000 })
  : serviceRow(id));

async function shown(lang: "en" | "hi" = "en") {
  renderWithin(<ServiceSection />, lang);
  await waitFor(() => expect(cells(rowOf(1))[2]).toBe("64"));
}

beforeEach(() => { api.mockReset(); route(api, { services: figures }); });
afterEach(() => cleanup());

describe("the service-wise progress section", () => {
  it("lists the ten daily services in the entry form's order, numbered as the form numbers them", async () => {
    await shown();

    expect(screen.getByRole("heading", { level: 2, name: "Service-wise progress" })).toBeTruthy();
    expect(head()).toEqual(["No.", "Service", "Received", "Disposed", "Disposal %", "Pending", "Collected (₹)"]);
    expect(bodyRows().map((row) => cells(row)[0])).toEqual(OFFERED_IDS.map(servicePosition));
    expect(cells(rowOf(1))[1]).toBe(name(1));
  });

  it("shows a queue-and-fee service in full, and a queue-only service with its collection blank", async () => {
    await shown();

    expect(cells(rowOf(1)).slice(2)).toEqual(["64", "52", "81.3%", "412", "₹1,28,000.00"]);
    expect(cells(rowOf(11)).slice(2)).toEqual(["121", "118", "97.5%", "206", ""]);
  });

  it("shows a collection as its payments and its amount, with every queue figure blank", async () => {
    await shown();

    expect(cells(rowOf(2))[1]).toContain(name(2));
    expect(cells(rowOf(2))[1]).toContain("212 payments");
    expect(cells(rowOf(2)).slice(2)).toEqual(["", "", "", "", "₹7,64,300.00"]);
    expect(cells(rowOf(1))[1]).not.toContain("payments");
  });

  it("prints zero for a queue with nothing in it, and a dash for a ratio with nothing received", async () => {
    await shown();

    // Service 3 keeps a queue and takes a fee; nothing was filed for it.
    expect(cells(rowOf(3)).slice(2)).toEqual(["0", "0", "—", "0", "₹0.00"]);
  });

  it("totals the queue figures over the services that keep a queue, and the collection over all", async () => {
    await shown();

    expect(cells(totalRow())).toEqual(["", "TOTAL", "185", "170", "91.9%", "618", "₹8,92,300.00"]);
  });

  it("draws each pending bar against the largest pending", async () => {
    await shown();
    const width = (id: number) => (rowOf(id).querySelector("[data-pending-bar]") as HTMLElement).style.width;

    expect(width(1)).toBe("100%");
    expect(width(11)).toBe("50%");
    expect(width(3)).toBe("0%");
    expect(rowOf(2).querySelector("[data-pending-bar]")).toBeNull();
  });

  it("asks for today across all offices first, and narrows to the Anchal chosen", async () => {
    await shown();
    expect(paths(api, "/dashboard/services")[0]).toBe(`/dashboard/services?from=${today}&to=${today}`);

    await userEvent.setup().selectOptions(screen.getByLabelText("Anchal"), "3");

    await waitFor(() => expect(paths(api, "/dashboard/services").at(-1)).toBe(`/dashboard/services?from=${today}&to=${today}&officeId=3`));
  });

  it("says it in Hindi", async () => {
    await shown("hi");

    expect(screen.getByRole("heading", { level: 2, name: "सेवावार प्रगति" })).toBeTruthy();
    expect(head()).toEqual(["क्र.", "सेवा", "प्राप्त", "निस्तारित", "निस्तारण %", "लंबित", "संग्रहित (₹)"]);
    expect(cells(rowOf(2))[1]).toContain(name(2, "hi"));
    expect(cells(rowOf(2))[1]).toContain("212 भुगतान");
    expect(cells(totalRow())[1]).toBe("कुल");
  });

  it("stays standing with all ten rows at zero when the server sends nothing", async () => {
    route(api, { services: [] });
    renderWithin(<ServiceSection />);

    await waitFor(() => expect(bodyRows().length).toBe(10));
    expect(cells(rowOf(1)).slice(2)).toEqual(["0", "0", "—", "0", "₹0.00"]);
  });

  it("shows no table while the custom period cannot be asked for", async () => {
    await shown();
    await userEvent.setup().click(screen.getByRole("button", { name: "Custom" }));

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: addDays(todayIST(), -5) } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: addDays(todayIST(), -10) } });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("takes no line on a phone for a figure the service does not record", async () => {
    await shown();
    const tds = (id: number) => Array.from(rowOf(id).querySelectorAll("td"));

    // A collection: the four queue cells are empty and hidden when empty; Collected has content.
    for (const td of tds(2).slice(2, 6)) {
      expect(td.childNodes.length).toBe(0);
      expect(td.className).toContain("max-lg:empty:hidden");
    }
    expect(tds(2)[6].childNodes.length).toBeGreaterThan(0);
    // A queue-only service: Collected is empty and hidden when empty.
    expect(tds(11)[6].childNodes.length).toBe(0);
    expect(tds(11)[6].className).toContain("max-lg:empty:hidden");
    // The total row's empty number cell is hidden on a phone.
    expect(totalRow().querySelector("td")!.className).toContain("max-lg:hidden");
  });
});
