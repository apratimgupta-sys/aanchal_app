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
  role: "FieldOfficer",
};
const office3: OfficerProfile = { ...officer, id: "a3", username: "anchal3", name: "Anchal 3 office", designation: "Office", role: "AnchalOffice" };

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
    await user.click(await screen.findByRole("button", { name: /add user/i }));
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
    await user.click(screen.getByRole("button", { name: /add user/i }));

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
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText("Temp#2026cd")).toBeTruthy();
  });

  it("renders in Hindi", async () => {
    listOfficers.mockResolvedValue([]);
    renderPage("hi");
    expect(await screen.findByRole("heading", { level: 1, name: "उपयोगकर्ता प्रबंधन" })).toBeTruthy();
  });
});

describe("Officers — review findings", () => {
  it("reports a refused creation instead of failing silently", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    listOfficers.mockResolvedValue([]);
    createOfficer.mockRejectedValue(
      new RequestError({ code: "conflict", message: "That username is already taken" }, 409),
    );
    renderPage();
    await user.type(await screen.findByLabelText(/username/i), "je.kadru");
    await user.type(screen.getByLabelText(/^name/i), "A. Kumar");
    await user.type(screen.getByLabelText(/designation/i), "Junior Engineer");
    await user.click(screen.getByRole("button", { name: /add user/i }));
    expect(await screen.findByText(/already taken/i)).toBeTruthy();
  });

  it("reports a refused deactivation", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    listOfficers.mockResolvedValue([officer]);
    setOfficerActive.mockRejectedValue(
      new RequestError({ code: "unauthorised", message: "Please sign in" }, 401),
    );
    renderPage();
    await user.click(await screen.findByRole("button", { name: /deactivate/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText(/please sign in/i)).toBeTruthy();
  });

  it("asks before resetting a working password", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([officer]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: /reset password/i }));
    expect(resetOfficerPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/will not be able to sign in with their current password/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(resetOfficerPassword).toHaveBeenCalledWith("o1"));
  });

  it("reports a refused reset", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    listOfficers.mockResolvedValue([officer]);
    resetOfficerPassword.mockRejectedValue(
      new RequestError({ code: "gone", message: "Officer not found" }, 404),
    );
    renderPage();
    await user.click(await screen.findByRole("button", { name: /reset password/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText(/officer not found/i)).toBeTruthy();
  });
});

describe("Officers — role manager", () => {
  it("offers a field officer or an Anchal office login, and nothing else", async () => {
    listOfficers.mockResolvedValue([]);
    renderPage();
    const roles = await screen.findByLabelText(/^role$/i);
    expect(within(roles).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)).toEqual(["FieldOfficer", "AnchalOffice"]);
  });

  it("offers the six existing Anchals and no others", async () => {
    listOfficers.mockResolvedValue([]);
    renderPage();
    const anchals = await screen.findByLabelText(/home anchal/i);
    expect(within(anchals).getAllByRole("option")).toHaveLength(6);
  });

  it("sends the chosen role and Anchal when creating an office login", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([]);
    createOfficer.mockResolvedValue({ officer: office3, temporaryPassword: "Temp#2026ef" });
    renderPage();
    await user.selectOptions(await screen.findByLabelText(/^role$/i), "AnchalOffice");
    await user.type(screen.getByLabelText(/username/i), "anchal3b");
    await user.type(screen.getByLabelText(/^name/i), "Anchal 3 second login");
    await user.type(screen.getByLabelText(/designation/i), "Office");
    await user.selectOptions(screen.getByLabelText(/^anchal$/i), "3");
    await user.click(screen.getByRole("button", { name: /add user/i }));
    await waitFor(() =>
      expect(createOfficer).toHaveBeenCalledWith({
        username: "anchal3b", name: "Anchal 3 second login", designation: "Office", role: "AnchalOffice", homeOfficeId: 3,
      }),
    );
  });

  it("defaults to a field officer", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([]);
    createOfficer.mockResolvedValue({ officer, temporaryPassword: "Temp#2026gh" });
    renderPage();
    await user.type(await screen.findByLabelText(/username/i), "je.kadru");
    await user.type(screen.getByLabelText(/^name/i), "A. Kumar");
    await user.type(screen.getByLabelText(/designation/i), "Junior Engineer");
    await user.click(screen.getByRole("button", { name: /add user/i }));
    await waitFor(() => expect(createOfficer.mock.calls[0][0]).toMatchObject({ role: "FieldOfficer" }));
  });

  it("says which role each user has", async () => {
    listOfficers.mockResolvedValue([officer, office3]);
    renderPage();
    const rows = await screen.findAllByRole("listitem");
    expect(within(rows[0]).getByText("Field officer")).toBeTruthy();
    expect(within(rows[1]).getByText("Anchal office login")).toBeTruthy();
  });

  it("warns that deactivating an Anchal's only login locks the Anchal out of filing", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([officer, office3]);
    renderPage();
    const rows = await screen.findAllByRole("listitem");
    await user.click(within(rows[1]).getByRole("button", { name: /deactivate/i }));
    expect(screen.getByText(/only active login for Anchal 3/i)).toBeTruthy();
    expect(screen.getByText(/not be able to file daily entries/i)).toBeTruthy();
  });

  it("does not claim a lock-out when the Anchal has another active login", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([office3, { ...office3, id: "a3b", username: "anchal3b" }]);
    renderPage();
    const rows = await screen.findAllByRole("listitem");
    await user.click(within(rows[0]).getByRole("button", { name: /deactivate/i }));
    expect(screen.queryByText(/only active login/i)).toBeNull();
    expect(screen.getByText(/still has another active login/i)).toBeTruthy();
  });

  it("keeps the plain field-officer confirmation for a field officer", async () => {
    const user = userEvent.setup();
    listOfficers.mockResolvedValue([officer, office3]);
    renderPage();
    const rows = await screen.findAllByRole("listitem");
    await user.click(within(rows[0]).getByRole("button", { name: /deactivate/i }));
    expect(screen.getByText(/not be able to sign in or record visits/i)).toBeTruthy();
    expect(screen.queryByText(/Anchal 3 will not/i)).toBeNull();
  });

  it("renders the role choice and roster in Hindi", async () => {
    listOfficers.mockResolvedValue([office3]);
    renderPage("hi");
    expect(await screen.findByLabelText("भूमिका")).toBeTruthy();
    expect(await screen.findByText("अंचल कार्यालय लॉगिन", { selector: "span" })).toBeTruthy();
  });
});
