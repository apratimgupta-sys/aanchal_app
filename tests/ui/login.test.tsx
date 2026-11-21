// @vitest-environment jsdom
// Pins Login's behaviour so the restyle can prove it moved nothing: validation,
// the server-error notice, the submit-in-flight label, the language toggle and
// the bilingual strings. Nothing here asserts a class name.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import Login from "../../src/client/pages/Login";

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast }));

function renderLogin(lang: "en" | "hi" = "en") {
  const onLogin = vi.fn();
  const onLanguageToggle = vi.fn();
  render(
    <Language.Provider value={lang}>
      <Login onLogin={onLogin} onLanguageToggle={onLanguageToggle} languageLabel={lang === "en" ? "हिन्दी" : "English"} />
    </Language.Provider>,
  );
  return { onLogin, onLanguageToggle };
}

beforeEach(() => {
  cleanup();
  api.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("Login", () => {
  it("is a main landmark that skip links can focus, with the sign-in heading", () => {
    renderLogin();
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    expect(main.tabIndex).toBe(-1);
    expect(screen.getByRole("heading", { name: "Office sign in" })).toBeTruthy();
  });

  it("labels both controls and gives them the right autocomplete", () => {
    renderLogin();
    expect(screen.getByLabelText("Username", { exact: true }).getAttribute("autocomplete")).toBe("username");
    const password = screen.getByLabelText("Password", { exact: true });
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
  });

  it("submits trimmed credentials and reports success", async () => {
    api.mockResolvedValue({});
    const { onLogin } = renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "  anchal-7 ");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in →" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith("/login", "POST", { username: "anchal-7", password: "secret" });
    expect(toast.success).toHaveBeenCalledWith("Signed in successfully");
  });

  it("blocks an empty submit and marks each field invalid with its message", async () => {
    renderLogin();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in →" }));
    const username = await screen.findByLabelText("Username");
    const password = screen.getByLabelText("Password");
    expect(api).not.toHaveBeenCalled();
    for (const [control, message] of [[username, "Username is required"], [password, "Password is required"]] as const) {
      expect(control.getAttribute("aria-invalid")).toBe("true");
      const described = control.getAttribute("aria-describedby");
      expect(described).toBeTruthy();
      expect(document.getElementById(described!)?.textContent).toContain(message);
    }
  });

  it("shows a server failure as an alert and a toast, and re-enables the button", async () => {
    api.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "a");
    await user.type(screen.getByLabelText("Password"), "b");
    await user.click(screen.getByRole("button", { name: "Sign in →" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid credentials");
    expect(toast.error).toHaveBeenCalledWith("Sign in failed");
    expect((screen.getByRole("button", { name: "Sign in →" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the submit button and says so while the request is in flight", async () => {
    api.mockReturnValue(new Promise(() => {}));
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "a");
    await user.type(screen.getByLabelText("Password"), "b");
    await user.click(screen.getByRole("button", { name: "Sign in →" }));
    const busy = (await screen.findByRole("button", { name: "Signing in…" })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });

  it("hands the language toggle to the caller", async () => {
    const { onLanguageToggle } = renderLogin();
    await userEvent.setup().click(screen.getByRole("button", { name: "हिन्दी" }));
    expect(onLanguageToggle).toHaveBeenCalledOnce();
  });

  it("renders every string in Hindi, validation and server errors included", async () => {
    api.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin("hi");
    expect(screen.getByRole("heading", { name: "कार्यालय लॉगिन" })).toBeTruthy();
    expect(screen.getByLabelText("उपयोगकर्ता नाम", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("पासवर्ड", { exact: true })).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "लॉगिन →" }));
    expect(await screen.findByText("उपयोगकर्ता नाम आवश्यक है")).toBeTruthy();
    expect(screen.getByText("पासवर्ड आवश्यक है")).toBeTruthy();
    await user.type(screen.getByLabelText("उपयोगकर्ता नाम"), "a");
    await user.type(screen.getByLabelText("पासवर्ड"), "b");
    await user.click(screen.getByRole("button", { name: "लॉगिन →" }));
    await screen.findByRole("alert");
    expect(toast.error).toHaveBeenCalledWith("प्रवेश असफल");
  });
});
