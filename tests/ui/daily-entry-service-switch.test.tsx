// @vitest-environment jsdom
// Switching service after typing. The office types into one service, notices it
// picked the wrong one, switches and retypes — the most ordinary correction
// there is. Before this was fixed, confirming "Discard unsaved changes?" moved
// the selection but not the draft, so the panel described one service and the
// POST named another, and the server could not catch it: it looks the entry up
// by the body's own serviceId.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import { servicePosition } from "./service-position";
import DailyEntry from "../../src/client/pages/DailyEntry";

const api = vi.hoisted(() => vi.fn());
const RequestError = vi.hoisted(
  () =>
    class RequestError extends Error {
      detail: { fieldErrors?: Record<string, string> | null };
      constructor(
        message: string,
        detail: { fieldErrors?: Record<string, string> | null } = {},
      ) {
        super(message);
        this.detail = detail;
      }
    },
);
vi.mock("../../src/client/api", () => ({ api, RequestError }));

const OPENINGS = Array.from({ length: 25 }, (_, i) => ({
  serviceId: i + 1,
  opening: { service: 0, complaints: 0, field: 0 },
}));

async function renderForm() {
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") =>
    method === "GET" ? { setup: null, entries: [], openings: OPENINGS } : {},
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

async function pick(user: ReturnType<typeof userEvent.setup>, id: number) {
  await user.click(screen.getByRole("button", { name: new RegExp(`^${servicePosition(id)}(?!\\d)`) }));
  await screen.findByText(new RegExp(`SERVICE ${servicePosition(id)}\\b`));
}

const number = (name: string) =>
  screen.getByRole("spinbutton", { name }) as HTMLInputElement;
// Every field the entry panel renders, by the name an office reads off it.
const panelFields = () =>
  Array.from(
    document.querySelectorAll(".entry-panel form input, .entry-panel form select, .entry-panel form textarea"),
  ).map((el) => {
    const id = el.getAttribute("id");
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return (el.getAttribute("aria-label") ?? label?.textContent ?? "")
      .replace(/\s*\*\s*$/, "")
      .trim();
  });
const eyebrow = () =>
  document.querySelector(".entry-panel .eyebrow")?.textContent ?? "";
const DATE_AND_WARD = ["Reporting / registration date", "Ward"];
const ward = () =>
  screen.getByRole("combobox", { name: "Ward" }) as HTMLSelectElement;

async function filed() {
  await waitFor(() =>
    expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(true),
  );
  return api.mock.calls.find((c) => c[1] === "POST")![2].input;
}

beforeEach(() => {
  cleanup();
  // jsdom's confirm returns undefined, which the page reads as "keep editing".
  // The branch under test is the one where the office says yes.
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("switching service with an unsaved draft", () => {
  it("files against the service on screen, not the one typed into first", async () => {
    const user = await renderForm();

    // Service 1, a counter service: two figures typed, nothing saved.
    await user.selectOptions(ward(), "Ward 4");
    await user.type(number("Received"), "5");
    await user.type(number("Disposed"), "3");

    // Wrong service. Switch, and confirm the discard.
    await pick(user, 3);

    // The draft really was discarded: the boxes belong to service 3 now.
    expect(number("Received").value).toBe("");
    expect(number("Disposed").value).toBe("");
    expect(ward().value).toBe("");

    await user.selectOptions(ward(), "Ward 9");
    await user.type(number("Received"), "7");
    await user.type(number("Disposed"), "2");
    await user.click(screen.getByRole("button", { name: /submit entry/i }));

    const input = await filed();
    // The figure must reach the service whose boxes the office filled in.
    expect(input.serviceId).toBe(3);
    expect(input.received).toBe(7);
    expect(input.completed).toBe(2);
  });

  it("leaves a saveable form when the shapes differ", async () => {
    const user = await renderForm();

    // Only the ward: the counter shape's two figures are left empty, so its
    // schema cannot be satisfied by anything the next shape collects.
    await user.selectOptions(ward(), "Ward 4");

    // Service 9 is field work: one figure, labelled "Routes", and no Received
    // box for a stale counter rule to complain about.
    await pick(user, 9);
    expect(screen.queryByRole("spinbutton", { name: "Received" })).toBeNull();

    await user.selectOptions(ward(), "Ward 9");
    await user.type(number("Routes"), "4");
    await user.click(screen.getByRole("button", { name: /submit entry/i }));

    const input = await filed();
    expect(input.serviceId).toBe(9);
    expect(input.completed).toBe(4);
    expect(input.received).toBe(0);
    // Not "Please correct the highlighted fields" with nothing highlighted.
    expect(screen.queryByText(/correct the highlighted fields/i)).toBeNull();
  });

  it("keeps the draft when the office says no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = await renderForm();
    await user.selectOptions(ward(), "Ward 4");
    await user.type(number("Received"), "5");

    await user.click(screen.getByRole("button", { name: /^02(?!\d)/ }));

    // Still on service 1, still holding what was typed.
    expect(screen.getByText(/SERVICE 01\b/)).toBeTruthy();
    expect(number("Received").value).toBe("5");
    expect(ward().value).toBe("Ward 4");
  });
});

// Part (2) of the fix — keying the panel to the draft's own service rather than
// to the selection — is defence in depth, and defence in depth is invisible.
// With the draft cleared on every confirmed switch, `selected` and
// `input.serviceId` are never observably different: React commits no frame
// between the click and the re-seed (checked: right after a raw dispatch the
// selection highlight has not moved either), so no rendered output and no
// submitted record can tell the two keyings apart. The three cases above all
// stay green when part (2) alone is reverted.
//
// What can still be pinned is the keying itself, so that dropping it is a test
// failure rather than a silent return to the shape that let a figure be filed
// against the wrong service. This asserts source, which is a poor kind of test
// and deliberate here: there is no behavioural one to write.
describe("the entry panel is keyed to the draft, not to the selection", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/client/pages/DailyEntry.tsx"),
    "utf8",
  );

  it("derives the service, its shape and its fields from the draft", () => {
    expect(source).toContain("const formServiceId = input.serviceId;");
    for (const derivation of [
      "const service = services.find((s) => s.id === formServiceId)!",
      "const shape = formShape(formServiceId)",
      "const shownFields = numericFields(formServiceId)",
      "data?.openings.find((b) => b.serviceId === formServiceId)",
    ])
      expect(source, `${derivation} must read the draft's service`).toContain(
        derivation,
      );
  });

  it("leaves nothing in the panel keyed back to the selection", () => {
    for (const keyedToSelection of [
      "formShape(selected)",
      "numericFields(selected)",
      "services.find((s) => s.id === selected)",
      "openings.find((b) => b.serviceId === selected)",
    ])
      expect(source, `${keyedToSelection} would reopen the gap`).not.toContain(
        keyedToSelection,
      );
  });
});
