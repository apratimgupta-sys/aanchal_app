// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import ChangePassword from "../../src/client/pages/ChangePassword";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>(
    "../../src/client/api",
  );
  return { ...actual, api };
});

function renderPage(onChanged = vi.fn(), lang: "en" | "hi" = "en") {
  render(
    <Language.Provider value={lang}>
      <ChangePassword onChanged={onChanged} />
    </Language.Provider>,
  );
  return { onChanged };
}

beforeEach(() => {
  cleanup();
  api.mockReset();
});

describe("ChangePassword", () => {
  it("does not call the API when the confirmation does not match", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/current password/i), "Anchal@1@2026");
    await user.type(screen.getByLabelText(/^new password/i), "Kadru#2026je");
    await user.type(screen.getByLabelText(/confirm/i), "Kadru#2026JE");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(api).not.toHaveBeenCalled();
    expect(await screen.findByText(/both passwords must match/i)).toBeTruthy();
  });

  it("posts the change and tells its parent when the form is valid", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue(undefined);
    const { onChanged } = renderPage();
    await user.type(screen.getByLabelText(/current password/i), "Anchal@1@2026");
    await user.type(screen.getByLabelText(/^new password/i), "Kadru#2026je");
    await user.type(screen.getByLabelText(/confirm/i), "Kadru#2026je");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/password", "POST", {
        currentPassword: "Anchal@1@2026",
        newPassword: "Kadru#2026je",
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows the server's message and keeps the officer on the page when the change is refused", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    api.mockRejectedValue(
      new RequestError({ code: "bad_password", message: "Current password is incorrect" }, 400),
    );
    const { onChanged } = renderPage();
    await user.type(screen.getByLabelText(/current password/i), "wrong-password");
    await user.type(screen.getByLabelText(/^new password/i), "Kadru#2026je");
    await user.type(screen.getByLabelText(/confirm/i), "Kadru#2026je");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("renders in Hindi and keeps the language toggle available", () => {
    renderPage(vi.fn(), "hi");
    expect(screen.getByRole("heading", { name: /पासवर्ड बदलें/ })).toBeTruthy();
  });

  it("says the current password is the temporary one if an administrator has just reset it", () => {
    renderPage();
    const hint = screen.getByText(/administrator has just reset your password/i);
    expect(hint.textContent).toMatch(/current password is the temporary one/i);
    // Field wires everything after the control into aria-describedby.
    const help = hint.closest("[id$='-help']")!;
    expect(screen.getByLabelText(/current password/i).getAttribute("aria-describedby")).toContain(help.id);
  });

  it("says it in Hindi too", () => {
    renderPage(vi.fn(), "hi");
    const hint = document.getElementById(screen.getByLabelText(/वर्तमान पासवर्ड/).getAttribute("aria-describedby")!)!;
    expect(hint.textContent).toMatch(/अस्थायी पासवर्ड/);
    expect(hint.textContent).toMatch(/रीसेट/);
  });
});
