// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WardSection from "../../src/client/pages/dashboard/WardSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { paths, renderWithin, route, visitSummary } from "./dashboard-harness";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const ward = (n: number) => document.querySelector(`[data-ward="${n}"]`) as HTMLElement;
const wards = () => Array.from(document.querySelectorAll("[data-ward]"));
const visited = visitSummary({ visits: 11, officers: 4, wards: [{ ward: 3, visits: 1 }, { ward: 8, visits: 2 }, { ward: 24, visits: 3 }, { ward: 45, visits: 5 }] });

beforeEach(() => { api.mockReset(); route(api, { summary: visited }); });
afterEach(() => cleanup());

describe("the where-the-visits-were section", () => {
  it("shows all 53 wards in order, and says how many had no visit", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(screen.getByRole("heading", { level: 2, name: "Where the visits were" })).toBeTruthy();
    expect(wards().map((w) => w.querySelector("[data-ward-number]")!.textContent!.trim())).toEqual(Array.from({ length: 53 }, (_, i) => String(i + 1)));
    expect(document.body.textContent).toContain("All 53 wards. 49 had no visit in this period.");
  });

  it("shades a ward by its visits in four steps, three or more being the darkest", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(ward(1).className).toContain("bg-card");
    expect(ward(3).className).toContain("bg-ward-1");
    expect(ward(8).className).toContain("bg-ward-2");
    expect(ward(45).className).toContain("bg-ward-3");
    for (const n of [1, 3, 8]) expect(ward(n).className).not.toContain("bg-ward-3");
  });

  it("names each ward and its visits for someone who cannot see the shading", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(ward(1).textContent).toContain("Ward 1, no visits");
    expect(ward(3).textContent).toContain("Ward 3, 1 visit");
    expect(ward(24).textContent).toContain("Ward 24, 3 visits");
    expect(ward(24).hasAttribute("aria-label")).toBe(false);
    expect(ward(24).querySelector(".sr-only")!.textContent).toBe("Ward 24, 3 visits");
  });

  it("prints a visited ward's count under its number, and nothing for an unvisited one", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(ward(24).querySelector("[data-ward-count]")!.textContent).toBe("3");
    expect(ward(3).querySelector("[data-ward-count]")!.textContent).toBe("1");
    expect(ward(1).querySelector("[data-ward-count]")).toBeNull();
    expect(ward(24).querySelector("[data-ward-count]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("has a key for the four steps", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));
    const key = document.querySelector("[data-ward-legend]")!.textContent!;

    for (const text of ["None", "1", "2", "3 or more"]) expect(key).toContain(text);
  });

  it("has a period of its own and no other filter", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));
    expect(paths(api, "/field-visits/summary")[0]).toBe(`/field-visits/summary?from=${today}&to=${today}`);
    expect(screen.queryByLabelText("Anchal")).toBeNull();
    expect(screen.queryByLabelText("Service")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));

    await waitFor(() => expect(paths(api, "/field-visits/summary").at(-1)).toBe(`/field-visits/summary?from=${addDays(today, -6)}&to=${today}`));
  });

  it("shows every ward empty when there were no visits", async () => {
    route(api, { summary: visitSummary() });
    renderWithin(<WardSection />);

    await waitFor(() => expect(document.body.textContent).toContain("All 53 wards. 53 had no visit in this period."));
    expect(wards().every((w) => w.className.includes("bg-card"))).toBe(true);
  });

  it("says it in Hindi", async () => {
    renderWithin(<WardSection />, "hi");
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(screen.getByRole("heading", { level: 2, name: "निरीक्षण कहाँ हुए" })).toBeTruthy();
    expect(document.body.textContent).toContain("सभी 53 वार्ड। इस अवधि में 49 वार्डों में कोई निरीक्षण नहीं हुआ।");
    expect(ward(24).textContent).toContain("वार्ड 24, 3 निरीक्षण");
    expect(ward(1).textContent).toContain("वार्ड 1, कोई निरीक्षण नहीं");
    expect(document.querySelector("[data-ward-legend]")!.textContent).toContain("3 या अधिक");
  });
});
