// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollectionSection from "../../src/client/pages/dashboard/CollectionSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { collects } from "../../src/domain/service-kind";
import services from "../../src/shared/services.json";
import { dayRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const monthStart = `${today.slice(0, 8)}01`;
const days = [dayRow(addDays(today, -2), { amountPaise: 50000 }), dayRow(addDays(today, -1)), dayRow(today, { amountPaise: 30000 })];
const lastPath = () => paths(api, "/dashboard/days").at(-1);
const bars = () => document.querySelectorAll("[data-bar]").length;

beforeEach(() => { api.mockReset(); route(api, { days }); });
afterEach(() => cleanup());

describe("the collection section", () => {
  it("opens on this month, with a bar per day and the period's total", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));

    expect(screen.getByRole("heading", { level: 2, name: "Collection" })).toBeTruthy();
    expect(paths(api, "/dashboard/days")[0]).toBe(`/dashboard/days?from=${monthStart}&to=${today}`);
    expect(document.querySelector("[data-collection-total]")!.textContent).toContain("₹800.00");
  });

  it("offers the past 7 days, this month and a custom period, and never a single day", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));

    expect(within(screen.getByRole("group", { name: "Period" })).getAllByRole("button").map((b) => b.textContent))
      .toEqual(["Past 7 days", "This month", "Custom"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${addDays(today, -6)}&to=${today}`));
  });

  it("offers only the services that collect an amount, and narrows by Anchal and by service", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));
    const collecting = OFFERED_IDS.filter((id) => collects(id, "amountPaise"));
    const select = screen.getByLabelText("Service") as HTMLSelectElement;

    expect(collecting).toHaveLength(7);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 7 that collect",
      ...collecting.map((id) => `${servicePosition(id)} · ${services.find((s) => s.id === id)!.en}`),
    ]);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Anchal"), "4");
    await user.selectOptions(select, "2");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${monthStart}&to=${today}&officeId=4&serviceId=2`));
  });

  it.each([
    ["en", "Choose a period of 92 days or fewer"],
    ["hi", "92 दिन या उससे कम की अवधि चुनें"],
  ] as const)("shows the server's refusal of too long a period (%s)", async (lang, message) => {
    api.mockRejectedValue(new Error("Choose a period of 92 days or fewer"));
    renderWithin(<CollectionSection />, lang);

    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("says it in Hindi", async () => {
    renderWithin(<CollectionSection />, "hi");
    await waitFor(() => expect(bars()).toBe(3));

    expect(screen.getByRole("heading", { level: 2, name: "संग्रह" })).toBeTruthy();
    expect((screen.getByLabelText("सेवा") as HTMLSelectElement).options[0].textContent).toBe("राशि लेने वाली सभी 7 सेवाएँ");
  });
});
