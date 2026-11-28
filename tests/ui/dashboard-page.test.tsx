// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../../src/client/pages/Dashboard";
import { anchalRow, renderWithin, route } from "./dashboard-harness";

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
    await screen.findByText("Anchal 1");

    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Office monitoring dashboard"]);
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toBe("Anchal-wise performance");
    expect(document.querySelector("main")).toBeNull();
  });

  it("has no filing status, no tiles and no page-wide filter", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");

    expect(document.body.textContent).not.toMatch(/Filed today|Filing status|Total pending|Total collection|reports/);
    expect(document.querySelector("[data-metric]")).toBeNull();
    expect(screen.queryByLabelText("View")).toBeNull();
  });

  it("refreshes every section from the one Refresh button", async () => {
    route(api, { anchals: [anchalRow()] });
    const client = renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");
    const spy = vi.spyOn(client, "invalidateQueries");

    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] }));
  });
});
