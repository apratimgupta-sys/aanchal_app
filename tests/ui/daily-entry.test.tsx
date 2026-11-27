// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DailyEntry from "../../src/client/pages/DailyEntry";
import { todayIST } from "../../src/domain/ledger";

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
  it("is not inferred when the office types zeros into the boxes", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.selectOptions(screen.getByRole("combobox", { name: /^ward\b/i }), "Ward 24");
    // Service 1 collects two counts and an amount, so the boxes are Received,
    // Disposed and Amount Collected: a typed zero in each is a figure.
    for (const label of [/^applications received/i, /^applications disposed/i, /^amount collected/i])
      await user.type(screen.getByLabelText(label), "0");
    const input = await submittedInput(user);
    expect(input.nothingToReport).toBe(false);
    expect(input.received).toBe(0);
    expect(input.amountPaise).toBe(0);
  });

  // The button that set the flag is gone, but an entry filed with it still
  // carries the flag, and correcting that entry with a figure must clear it.
  it("is withdrawn once a figure is typed on an entry that was filed with it", async () => {
    const user = userEvent.setup();
    api.mockImplementation(async (_path: string, method = "GET") =>
      method === "GET"
        ? {
            setup: null,
            entries: [
              {
                id: "entry-1", officeId: 1, serviceId: 1, serviceDate: todayIST(), reportingDate: todayIST(),
                ward: "Ward 24", received: 0, completed: 0, slaWithinTime: 0, amountPaise: 0,
                complaintsReceived: 0, complaintsResolved: 0, fieldReceived: 0, fieldCompleted: 0,
                avgDisposalDays: null, remarks: "", nothingToReport: true, version: 1,
                createdAt: "2026-11-01T04:30:00Z", updatedAt: "2026-11-01T04:30:00Z",
                opening: { service: 0, complaints: 0, field: 0 }, closing: { service: 0, complaints: 0, field: 0 },
              },
            ],
            openings: [],
          }
        : {},
    );
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.click(screen.getByRole("button", { name: /edit entry/i }));
    const received = screen.getByLabelText(/^applications received/i);
    await user.clear(received);
    await user.type(received, "3");
    await user.type(screen.getByRole("textbox", { name: /correction reason/i }), "corrected");
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    await waitFor(() => expect(api.mock.calls.some((c) => c[1] === "PUT")).toBe(true));
    const input = api.mock.calls.find((c) => c[1] === "PUT")![2].input;
    expect(input.nothingToReport).toBe(false);
    expect(input.received).toBe(3);
  });
});
