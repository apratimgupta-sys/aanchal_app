// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrendSection from "../../src/client/pages/dashboard/TrendSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { movesPendingBalance } from "../../src/domain/service-kind";
import services from "../../src/shared/services.json";
import { dayRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const monthStart = `${today.slice(0, 8)}01`;
const days = [dayRow(addDays(today, -1), { received: 402, completed: 368 }), dayRow(today, { received: 1418, completed: 371 })];
const lastPath = () => paths(api, "/dashboard/days").at(-1);
const lines = () => document.querySelectorAll("polyline[data-line]").length;

beforeEach(() => { api.mockReset(); route(api, { days }); });
afterEach(() => cleanup());

describe("the received and disposed section", () => {
  it("opens on this month, with a line each for received and disposed ending on the latest figures", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));

    expect(screen.getByRole("heading", { level: 2, name: "Received and disposed" })).toBeTruthy();
    expect(paths(api, "/dashboard/days")[0]).toBe(`/dashboard/days?from=${monthStart}&to=${today}`);
    expect(document.querySelector("[data-legend]")!.textContent).toMatch(/Received.*Disposed/);
    expect(Array.from(document.querySelectorAll("[data-end-label]")).map((e) => e.textContent)).toEqual(["1,418", "371"]);
  });

  it("offers only the services that take applications, and narrows by service and by Anchal", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));
    const queues = OFFERED_IDS.filter(movesPendingBalance);
    const select = screen.getByLabelText("Service") as HTMLSelectElement;

    expect(queues).toHaveLength(7);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 7 with applications",
      ...queues.map((id) => `${servicePosition(id)} · ${services.find((s) => s.id === id)!.en}`),
    ]);

    const user = userEvent.setup();
    await user.selectOptions(select, "11");
    await user.selectOptions(screen.getByLabelText("Anchal"), "2");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${monthStart}&to=${today}&officeId=2&serviceId=11`));
  });

  it("never offers a single day", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));

    expect(within(screen.getByRole("group", { name: "Period" })).getAllByRole("button").map((b) => b.textContent))
      .toEqual(["Past 7 days", "This month", "Custom"]);
  });

  it("says it in Hindi", async () => {
    renderWithin(<TrendSection />, "hi");
    await waitFor(() => expect(lines()).toBe(2));

    expect(screen.getByRole("heading", { level: 2, name: "प्राप्त और निस्तारित" })).toBeTruthy();
    expect(document.querySelector("[data-legend]")!.textContent).toMatch(/प्राप्त.*निस्तारित/);
    expect((screen.getByLabelText("सेवा") as HTMLSelectElement).options[0].textContent).toBe("आवेदन वाली सभी 7 सेवाएँ");
  });
});
