// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldVisitsSection from "../../src/client/pages/dashboard/FieldVisitsSection";
import { todayIST } from "../../src/domain/ledger";
import services from "../../src/shared/services.json";
import { paths, renderWithin, route, visitService, visitSummary } from "./dashboard-harness";
import { FIELD_WORK_IDS } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const card = (id: number) => document.querySelector(`[data-visit-card="${id}"]`)!;
const cards = () => Array.from(document.querySelectorAll("[data-visit-card]"));

// Waste vehicle with a quantity on seven of its nine visits; street dogs complete; street lighting by work type.
const busy = visitSummary({
  visits: 20, officers: 6,
  services: FIELD_WORK_IDS.map((id) =>
    id === 8 ? visitService(8, {
      visits: 9, wardsCovered: 6,
      numbers: [{ key: "quantityKg", sum: 4250, visits: 7 }],
      choices: [{ key: "wasteType", options: [
        { value: "wet", visits: 4, numbers: [{ key: "quantityKg", sum: 2100, visits: 4 }] },
        { value: "dry", visits: 2, numbers: [{ key: "quantityKg", sum: 1400, visits: 2 }] },
        { value: "mixed", visits: 1, numbers: [{ key: "quantityKg", sum: 750, visits: 1 }] },
      ] }],
    })
    : id === 10 ? visitService(10, { visits: 4, wardsCovered: 3, numbers: [{ key: "dogsPicked", sum: 27, visits: 4 }, { key: "dogsNeutered", sum: 20, visits: 4 }] })
    : id === 13 ? visitService(13, { visits: 7, wardsCovered: 5, choices: [{ key: "workType", options: [
        { value: "repair", visits: 4, numbers: [] }, { value: "replace", visits: 2, numbers: [] }, { value: "shift", visits: 1, numbers: [] },
      ] }] })
    : visitService(id)),
  wards: [{ ward: 24, visits: 3 }],
});

beforeEach(() => { api.mockReset(); route(api, { summary: busy }); });
afterEach(() => cleanup());

describe("the field visits section", () => {
  it("says how many visits by how many officers, and gives each field service its own card", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(screen.getByRole("heading", { level: 2, name: "Field visits" })).toBeTruthy();
    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("20 visits by 6 officers");
    expect(cards().map((c) => Number(c.getAttribute("data-visit-card")))).toEqual(FIELD_WORK_IDS);
    expect(card(8).textContent).toContain(services.find((s) => s.id === 8)!.en);
  });

  it("shows what each service counts: a sum and its split, two sums, or jobs by kind", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    for (const text of ["9 visits", "4,250", "kg lifted", "Wet 2,100 · Dry 1,400 · Mixed 750"]) expect(card(8).textContent).toContain(text);
    for (const text of ["4 visits", "27", "dogs picked", "20 neutered"]) expect(card(10).textContent).toContain(text);
    for (const text of ["7 visits", "jobs", "Repair 4 · Replace 2 · Shift 1"]) expect(card(13).textContent).toContain(text);
  });

  it("says how many visits gave no figure, and only where some did not", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(card(8).textContent).toContain("2 without a figure");
    expect(card(10).textContent).not.toContain("without a figure");
    expect(card(13).textContent).not.toContain("without a figure");
  });

  it("uses the singular for one visit and one officer", async () => {
    route(api, { summary: visitSummary({ visits: 1, officers: 1, services: FIELD_WORK_IDS.map((id) => visitService(id, id === 9 ? { visits: 1, wardsCovered: 1 } : {})) }) });
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("1 visit by 1 officer.");
    expect(card(9).textContent).toContain("1 visit");
    expect(card(9).textContent).not.toContain("1 visits");
    expect(card(9).textContent).toContain("in 1 ward");
  });

  it("says so when there were no visits, and shows no cards", async () => {
    route(api, { summary: visitSummary() });
    renderWithin(<FieldVisitsSection />);

    await waitFor(() => expect(document.querySelector("[data-no-visits]")!.textContent).toBe("No visits in this period."));
    expect(cards()).toHaveLength(0);
    expect(document.querySelector("[data-visit-count]")).toBeNull();
  });

  it("asks for today across all offices first, and narrows to the Anchal chosen", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));
    expect(paths(api, "/field-visits/summary")[0]).toBe(`/field-visits/summary?from=${today}&to=${today}`);

    await userEvent.setup().selectOptions(screen.getByLabelText("Anchal"), "5");

    await waitFor(() => expect(paths(api, "/field-visits/summary").at(-1)).toBe(`/field-visits/summary?from=${today}&to=${today}&officeId=5`));
  });

  it("says it in Hindi", async () => {
    renderWithin(<FieldVisitsSection />, "hi");
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(screen.getByRole("heading", { level: 2, name: "क्षेत्रीय निरीक्षण" })).toBeTruthy();
    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("6 अधिकारियों द्वारा 20 निरीक्षण");
    for (const text of [services.find((s) => s.id === 8)!.name, "9 निरीक्षण", "किग्रा उठाया", "गीला 2,100 · सूखा 1,400 · मिश्रित 750", "2 में आंकड़ा नहीं"])
      expect(card(8).textContent).toContain(text);
  });
});
