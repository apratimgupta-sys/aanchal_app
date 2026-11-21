// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DailyEntry from "../../src/client/pages/DailyEntry";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({
  api,
  RequestError: class RequestError extends Error {},
}));

const empty = { setup: null, entries: [], openings: [] };

function renderForm() {
  return render(
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
}

async function submittedInput(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /submit entry/i }));
  await waitFor(() => expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(true));
  return api.mock.calls.find((c) => c[1] === "POST")![2].input;
}

beforeEach(() => {
  cleanup();
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") => (method === "GET" ? empty : {}));
});

describe("nothing to report", () => {
  it("is recorded when the office uses Set zero activity", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.click(screen.getByRole("button", { name: /set zero activity/i }));
    const input = await submittedInput(user);
    expect(input.nothingToReport).toBe(true);
    expect(input.received).toBe(0);
  });

  it("is not inferred when the office types zeros into the boxes", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    // Service 1 takes the counter shape, so the boxes are Received and Disposed.
    for (const label of [/^received/i, /^disposed/i])
      await user.type(screen.getByLabelText(label), "0");
    const input = await submittedInput(user);
    expect(input.nothingToReport).toBe(false);
    expect(input.received).toBe(0);
  });

  it("is withdrawn once a figure is typed after Set zero activity", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    await user.click(screen.getByRole("button", { name: /set zero activity/i }));
    const received = screen.getByLabelText(/^received/i);
    await user.clear(received);
    await user.type(received, "3");
    const disposed = screen.getByLabelText(/^disposed/i);
    await user.clear(disposed);
    await user.type(disposed, "1");
    const input = await submittedInput(user);
    expect(input.nothingToReport).toBe(false);
    expect(input.received).toBe(3);
  });
});
