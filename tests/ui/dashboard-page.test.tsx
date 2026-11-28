// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../../src/client/pages/Dashboard";
import { anchalRow, paths, renderWithin, route, visitService, visitSummary } from "./dashboard-harness";
import { FIELD_WORK_IDS } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

beforeEach(() => {
  api.mockReset();
});
afterEach(() => cleanup());

describe("the Commissioner's dashboard page", () => {
  it("has one page heading and opens with the Anchal-wise performance section", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByRole("cell", { name: "Anchal 1" });

    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Office monitoring dashboard"]);
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toBe("Anchal-wise performance");
    expect(document.querySelector("main")).toBeNull();
  });

  it("has no filing status, no tiles and no page-wide filter", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByRole("cell", { name: "Anchal 1" });

    expect(document.body.textContent).not.toMatch(/Filed today|Filing status|Total pending|Total collection|reports/);
    expect(document.querySelector("[data-metric]")).toBeNull();
    expect(screen.queryByLabelText("View")).toBeNull();
  });

  it("refreshes every section from the one Refresh button", async () => {
    route(api, { anchals: [anchalRow()] });
    const client = renderWithin(<Dashboard />);
    await screen.findByRole("cell", { name: "Anchal 1" });
    const spy = vi.spyOn(client, "invalidateQueries");

    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] }));
  });

  it("lays the six sections out in the agreed order", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByRole("cell", { name: "Anchal 1" });

    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "Anchal-wise performance",
        "Field visits",
        "Where the visits were",
        "Service-wise progress",
        "Collection",
        "Received and disposed",
      ]),
    );
  });

  it("one section failing leaves the others standing, and says so in its own card", async () => {
    route(api, { anchals: [anchalRow()] });
    const answer = api.getMockImplementation()!;
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/dashboard/services")) throw new Error("Invalid reporting filters");
      return answer(path);
    });
    renderWithin(<Dashboard />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid reporting filters");
    expect(alert.closest("section")!.textContent).toContain("Service-wise progress");
    expect(screen.getByRole("cell", { name: "Anchal 1" })).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("changing one section's filter asks nothing of the others", async () => {
    route(api, {
      anchals: [anchalRow()],
      summary: visitSummary({ visits: 1, officers: 1, services: FIELD_WORK_IDS.map((id) => visitService(id, id === 9 ? { visits: 1, wardsCovered: 1 } : {})) }),
    });
    renderWithin(<Dashboard />);
    await screen.findByRole("cell", { name: "Anchal 1" });
    await waitFor(() => expect(paths(api, "/dashboard/days")).toHaveLength(2));
    await waitFor(() => expect(paths(api, "/field-visits/summary")).toHaveLength(2));
    const before = { days: paths(api, "/dashboard/days").length, visits: paths(api, "/field-visits/summary").length, services: paths(api, "/dashboard/services").length };

    const anchalCard = screen.getByRole("heading", { level: 2, name: "Anchal-wise performance" }).closest("section")!;
    const service = Array.from(anchalCard.querySelectorAll("select")).find((s) => s.options[0].textContent === "All 10 services")!;
    await userEvent.setup().selectOptions(service, "11");
    await waitFor(() => expect(paths(api, "/dashboard?").at(-1)).toContain("serviceId=11"));

    expect(paths(api, "/dashboard/days")).toHaveLength(before.days);
    expect(paths(api, "/field-visits/summary")).toHaveLength(before.visits);
    expect(paths(api, "/dashboard/services")).toHaveLength(before.services);
  });
});
