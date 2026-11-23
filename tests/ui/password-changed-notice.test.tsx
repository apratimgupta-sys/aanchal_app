// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/client/App";

vi.mock("../../src/client/pages/Officers", () => ({ default: () => <h1>USER ADMIN</h1> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The server signs the user out when a password change succeeds, so the session
// read that follows is a 401. The notice has to survive that.
let signedIn: boolean;
let mustChange: boolean;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  signedIn = true;
  mustChange = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input).replace("/v1/api/anchal", "");
    if (url === "/session")
      return signedIn
        ? json(200, { userId: "u", username: "rm", role: "rolemanager", officeId: null, expiresAt: 0, mustChangePassword: mustChange })
        : json(401, { code: "UNAUTHORISED", message: "Please sign in" });
    if (url === "/password") {
      signedIn = false;
      return new Response(null, { status: 204 });
    }
    if (url === "/login") {
      signedIn = true;
      mustChange = false;
      return json(200, {});
    }
    if (url === "/logout") {
      signedIn = false;
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected ${url}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function changePassword(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "Change your password" });
  await user.type(screen.getByLabelText(/current password/i), "Temp#2026ab");
  await user.type(screen.getByLabelText(/^new password/i), "Kadru#2026je");
  await user.type(screen.getByLabelText(/confirm/i), "Kadru#2026je");
  await user.click(screen.getByRole("button", { name: /change password/i }));
}

describe("after a successful password change", () => {
  it("tells the user on the login screen that it worked and to sign in with the new one", async () => {
    const user = userEvent.setup();
    render(<App />);
    await changePassword(user);
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/password was changed/i);
    expect(notice.textContent).toMatch(/new password/i);
    expect(screen.getByRole("heading", { name: "Office sign in" })).toBeTruthy();
  });

  it("does not tell a later, unrelated visit to the login screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await changePassword(user);
    await screen.findByRole("status");
    await user.type(screen.getByLabelText("Username"), "rm");
    await user.type(screen.getByLabelText("Password"), "Kadru#2026je");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await screen.findByRole("heading", { name: "USER ADMIN" });
    await user.click(screen.getAllByRole("button", { name: /sign out/i })[0]);
    await screen.findByRole("heading", { name: "Office sign in" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says it in Hindi when the portal is in Hindi", async () => {
    localStorage.setItem("rmc-language", "hi");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "पासवर्ड बदलें" });
    await user.type(screen.getByLabelText(/वर्तमान पासवर्ड/), "Temp#2026ab");
    await user.type(screen.getAllByLabelText(/नया पासवर्ड/)[0], "Kadru#2026je");
    await user.type(screen.getByLabelText(/दोहराएँ/), "Kadru#2026je");
    await user.click(screen.getByRole("button", { name: "पासवर्ड बदलें" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/पासवर्ड बदल/);
  });
});
