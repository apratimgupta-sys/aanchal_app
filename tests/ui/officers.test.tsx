// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import Officers from "../../src/client/pages/Officers";
import type { OfficerProfile } from "../../src/shared/types";

const listOfficers = vi.hoisted(() => vi.fn());
const createOfficer = vi.hoisted(() => vi.fn());
const setOfficerActive = vi.hoisted(() => vi.fn());
const resetOfficerPassword = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/officers", () => ({
  listOfficers,
  createOfficer,
  setOfficerActive,
  resetOfficerPassword,
}));

const officer: OfficerProfile = {
  id: "o1",
  username: "je.kadru",
  name: "A. Kumar",
  designation: "Junior Engineer",
  homeOfficeId: 3,
  active: true,
};

function renderPage(lang: "en" | "hi" = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <Officers />
      </Language.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  listOfficers.mockReset();
  createOfficer.mockReset();
  setOfficerActive.mockReset();
  resetOfficerPassword.mockReset();
});

describe("Officers", () => {
  it("lists officers with their designation and home Anchal", async () => {
    listOfficers.mockResolvedValue([officer]);
    renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText(/A\. Kumar/)).toBeTruthy();
    expect(within(row).getByText(/Junior Engineer/)).toBeTruthy();
    // Scoped to the row: "Anchal 3" is also an option in the add-officer form.
    expect(within(row).getByText(/Anchal 3/)).toBeTruthy();
  });

  it("refuses to create an officer without a username, name and designation", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: /add officer/i }));
    expect(createOfficer).not.toHaveBeenCalled();
    expect(await screen.findByText(/enter a username/i)).toBeTruthy();
  });

  it("creates an officer and shows the temporary password exactly once", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([]);
    createOfficer.mockResolvedValue({ officer, temporaryPassword: "Temp#2026ab" });
    renderPage();
    await user.type(await screen.findByLabelText(/username/i), "je.kadru");
    await user.type(screen.getByLabelText(/^name/i), "A. Kumar");
    await user.type(screen.getByLabelText(/designation/i), "Junior Engineer");
    await user.selectOptions(screen.getByLabelText(/home anchal/i), "3");
    await user.click(screen.getByRole("button", { name: /add officer/i }));

    await waitFor(() => expect(createOfficer).toHaveBeenCalled());
    const shown = await screen.findByText("Temp#2026ab");
    expect(shown).toBeTruthy();
    expect(screen.getByText(/will not be shown again/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Temp#2026ab")).toBeNull();
  });

  it("asks for confirmation before deactivating an officer", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([officer]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: /deactivate/i }));
    expect(setOfficerActive).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(setOfficerActive).toHaveBeenCalledWith("o1", false));
  });

  it("reactivates an inactive officer without a confirmation step", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([{ ...officer, active: false }]);
    setOfficerActive.mockResolvedValue({ ...officer, active: true });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /reactivate/i }));
    await waitFor(() => expect(setOfficerActive).toHaveBeenCalledWith("o1", true));
  });

  it("shows a reset password once, like a new one", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([officer]);
    resetOfficerPassword.mockResolvedValue({ temporaryPassword: "Temp#2026cd" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /reset password/i }));
    expect(await screen.findByText("Temp#2026cd")).toBeTruthy();
  });

  it("renders in Hindi", async () => {
    listOfficers.mockResolvedValue([]);
    renderPage("hi");
    expect(await screen.findByRole("heading", { level: 1, name: "क्षेत्रीय अधिकारी" })).toBeTruthy();
  });
});
