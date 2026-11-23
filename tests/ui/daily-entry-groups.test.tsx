// @vitest-environment jsdom
// The service list: numbered in list order (not by service id), and grouped
// under three collapsible headers.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DailyEntry from "../../src/client/pages/DailyEntry";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({
  api,
  RequestError: class RequestError extends Error {},
}));

async function renderForm() {
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") =>
    method === "GET" ? { setup: null, entries: [], openings: [] } : {},
  );
  const user = userEvent.setup();
  render(
    <Language.Provider value="en">
      <DailyEntry
        officeId={1}
        mode="today"
        startDate="2020-01-01"
        onDirtyChange={() => {}}
        preserveDraftSignal={0}
        onContinueDraftInBackdate={() => {}}
      />
    </Language.Provider>,
  );
  await screen.findByText(/daily service entry/i);
  return user;
}

const list = () => screen.getByRole("list", { name: "Municipal services" });
const header = (name: string) => screen.getByRole("button", { name });
const rows = () => within(list()).getAllByRole("button").filter((b) => !b.hasAttribute("aria-expanded"));

beforeEach(() => cleanup());

describe("service numbering", () => {
  it("numbers the list 01 to 25 in the order it is shown", async () => {
    await renderForm();
    expect(rows().map((b) => b.textContent!.slice(0, 2))).toEqual(
      Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
  });

  it("shows service 2 as 15, with the same number on the form, and still files it as service 2", async () => {
    const user = await renderForm();
    await user.click(screen.getByRole("button", { name: /^15(?!\d)/ }));
    expect(screen.getByText(/^SERVICE 15 ·/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Holding tax payment" })).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.type(screen.getByLabelText(/^payments/i), "1");
    await user.type(screen.getByLabelText(/^amount collected/i), "10");
    await user.click(screen.getByRole("button", { name: /submit entry/i }));
    await waitFor(() => expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(true));
    expect(api.mock.calls.find((c) => c[1] === "POST")![2].input.serviceId).toBe(2);
  });
});

describe("collapsible groups", () => {
  it("opens all three by default, each with a real button wired to its list", async () => {
    await renderForm();
    for (const name of ["Counter work", "Collections", "Field work"]) {
      const h = header(name);
      expect(h.tagName).toBe("BUTTON");
      expect(h.getAttribute("aria-expanded")).toBe("true");
      const panel = document.getElementById(h.getAttribute("aria-controls")!);
      expect(panel).not.toBeNull();
      expect(panel!.querySelectorAll("button").length).toBeGreaterThan(0);
    }
  });

  it("keeps the chevron out of the accessibility tree and the tab order", async () => {
    await renderForm();
    const svg = header("Counter work").querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("collapses and reopens a group from the keyboard", async () => {
    const user = await renderForm();
    const h = header("Collections");
    h.focus();
    await user.keyboard("{Enter}");
    expect(h.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /^15(?!\d)/ })).toBeNull();
    expect(header("Counter work").getAttribute("aria-expanded")).toBe("true");
    await user.keyboard(" ");
    expect(h.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /^15(?!\d)/ })).toBeTruthy();
  });

  it("tabs through header, then its services, then the next header", async () => {
    const user = await renderForm();
    header("Counter work").focus();
    await user.tab();
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^01/);
    for (let i = 0; i < 13; i++) await user.tab();
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^14/);
    await user.tab();
    expect(document.activeElement).toBe(header("Collections"));
  });

  it("keeps the selection and the draft when the selected service's group is collapsed", async () => {
    const user = await renderForm();
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 4");
    await user.type(screen.getByLabelText(/^received/i), "5");
    await user.click(header("Counter work"));
    expect(screen.queryByRole("button", { name: /^01(?!\d)/ })).toBeNull();
    // Panel and draft are untouched while the row is out of sight.
    expect(screen.getByText(/^SERVICE 01 ·/)).toBeTruthy();
    expect((screen.getByLabelText(/^received/i) as HTMLInputElement).value).toBe("5");
    await user.click(header("Counter work"));
    expect(screen.getByRole("button", { name: /^01(?!\d)/ }).getAttribute("aria-current")).toBe("true");
    expect((screen.getByLabelText(/^received/i) as HTMLInputElement).value).toBe("5");
  });
});
