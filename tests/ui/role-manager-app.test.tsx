// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/client/App";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", async (original) => ({
  ...(await original<typeof import("../../src/client/api")>()),
  api,
}));
vi.mock("../../src/client/pages/Officers", () => ({ default: () => <h1>USER ADMIN</h1> }));
vi.mock("../../src/client/pages/Dashboard", () => ({ default: () => <h1>DASHBOARD</h1> }));
vi.mock("../../src/client/pages/VisitRegister", () => ({ default: () => <h1>REGISTER</h1> }));

const session = (role: string) => ({ userId: "u", username: role, role, officeId: null, expiresAt: 0 });

function openAt(path: string, role: string) {
  window.history.replaceState({}, "", path);
  api.mockImplementation(async (url: string) => {
    if (url === "/session") return session(role);
    throw new Error(`unexpected ${url}`);
  });
  render(<App />);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  api.mockReset();
});

describe("routing by role", () => {
  it("lands a role manager on user administration, whatever the address", async () => {
    openAt("/", "rolemanager");
    expect(await screen.findByRole("heading", { name: "USER ADMIN" })).toBeTruthy();
    expect(window.location.pathname).toMatch(/\/rolemanager\/users$/);
    expect(screen.getAllByRole("button", { name: "User administration" }).length).toBeGreaterThan(0);
  });

  it("does not show a role manager the dashboard", async () => {
    openAt("/commissioner/dashboard", "rolemanager");
    expect(await screen.findByRole("heading", { name: "USER ADMIN" })).toBeTruthy();
    expect(screen.queryByText("DASHBOARD")).toBeNull();
  });

  it("gives the commissioner no nav entry for user administration", async () => {
    openAt("/commissioner/dashboard", "commissioner");
    expect(await screen.findByRole("heading", { name: "DASHBOARD" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /user administration|field officers/i })).toBeNull();
  });

  it.each(["/commissioner/officers", "/rolemanager/users"])(
    "sends a commissioner who types %s to the dashboard, not a broken page",
    async (path) => {
      openAt(path, "commissioner");
      expect(await screen.findByRole("heading", { name: "DASHBOARD" })).toBeTruthy();
      await waitFor(() => expect(window.location.pathname).toMatch(/\/commissioner\/dashboard$/));
      expect(screen.queryByText("USER ADMIN")).toBeNull();
    },
  );

  it("shows the temporary-password change to an office login that still has one", async () => {
    window.history.replaceState({}, "", "/");
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
    api.mockImplementation(async (url: string) => {
      if (url === "/session") return { ...session("office"), officeId: 3 };
      throw new RequestError({ code: "password_change_required", message: "Change your temporary password before using the portal" }, 403);
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Change your password" })).toBeTruthy();
    expect(screen.getByText(/before you continue/i)).toBeTruthy();
  });
});
