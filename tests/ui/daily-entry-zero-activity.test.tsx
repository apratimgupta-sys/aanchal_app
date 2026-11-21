// @vitest-environment jsdom
// "Set zero activity" on a correction. An entry filed before the form was
// reduced still carries figures the shape no longer asks for. The button must
// zero what the office is asked for and leave the rest as it was stored.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DailyEntry from "../../src/client/pages/DailyEntry";
import { todayIST } from "../../src/domain/ledger";
import type { EntryView } from "../../src/shared/types";

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

const stored = (serviceId: number): EntryView => ({
  id: "entry-1",
  officeId: 1,
  serviceId,
  serviceDate: todayIST(),
  reportingDate: todayIST(),
  ward: "Ward 11",
  received: 9,
  completed: 4,
  slaWithinTime: 6,
  amountPaise: 15000,
  complaintsReceived: 12,
  complaintsResolved: 11,
  fieldReceived: 3,
  fieldCompleted: 2,
  avgDisposalDays: 4.5,
  remarks: "kept as filed",
  nothingToReport: false,
  version: 1,
  createdAt: "2026-11-01T04:30:00Z",
  updatedAt: "2026-11-01T04:30:00Z",
  opening: { service: 0, complaints: 0, field: 0 },
  closing: { service: 5, complaints: 1, field: 1 },
});

async function correctAndZero(serviceId: number) {
  cleanup();
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") =>
    method === "GET"
      ? { setup: null, entries: [stored(serviceId)], openings: [] }
      : {},
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
  if (serviceId !== 1) {
    await user.click(screen.getByRole("button", { name: new RegExp(`^${String(serviceId).padStart(2, "0")}(?!\\d)`) }));
  }
  await screen.findByText(
    new RegExp(`SERVICE ${String(serviceId).padStart(2, "0")}\\b`),
  );
  await user.click(screen.getByRole("button", { name: /edit entry/i }));
  await user.click(screen.getByRole("button", { name: /Set zero activity/ }));
  await user.type(
    screen.getByRole("textbox", { name: /correction reason/i }),
    "corrected",
  );
  await user.click(screen.getByRole("button", { name: /save correction/i }));
  await waitFor(() =>
    expect(api.mock.calls.some((c) => c[1] === "PUT")).toBe(true),
  );
  return api.mock.calls.find((c) => c[1] === "PUT")![2].input;
}

beforeEach(() => {
  cleanup();
  api.mockReset();
});

describe("set zero activity on a correction", () => {
  it("leaves fields the shape does not collect as they were stored", async () => {
    // service 7, counter
    const sent = await correctAndZero(7);
    expect(sent.received).toBe(0);
    expect(sent.completed).toBe(0);
    expect(sent.nothingToReport).toBe(true);
    expect(sent.slaWithinTime).toBe(6);
    expect(sent.complaintsReceived).toBe(12);
    expect(sent.complaintsResolved).toBe(11);
    expect(sent.fieldReceived).toBe(3);
    expect(sent.fieldCompleted).toBe(2);
    expect(sent.avgDisposalDays).toBe(4.5);
    expect(sent.amountPaise).toBe(15000);
    expect(sent.ward).toBe("Ward 11");
    expect(sent.remarks).toBe("kept as filed");
  });

  it("zeroes only the one figure a field-work service collects", async () => {
    // service 8, field work
    const sent = await correctAndZero(8);
    expect(sent.completed).toBe(0);
    expect(sent.received).toBe(9);
    expect(sent.amountPaise).toBe(15000);
    expect(sent.fieldCompleted).toBe(2);
    expect(sent.nothingToReport).toBe(true);
  });

  it("zeroes payments and money for the revenue shape", async () => {
    // service 2, revenue
    const sent = await correctAndZero(2);
    expect(sent.received).toBe(0);
    expect(sent.amountPaise).toBe(0);
    expect(sent.completed).toBe(4);
    expect(sent.slaWithinTime).toBe(6);
    expect(sent.nothingToReport).toBe(true);
  });
});

describe("set zero activity, more shapes", () => {
  it("handles service 12, grievance by kind but counter by shape", async () => {
    const sent = await correctAndZero(12);
    expect(sent.received).toBe(0);
    expect(sent.completed).toBe(0);
    expect(sent.nothingToReport).toBe(true);
    expect(sent.complaintsReceived).toBe(12);
    expect(sent.complaintsResolved).toBe(11);
    expect(sent.slaWithinTime).toBe(6);
    expect(sent.amountPaise).toBe(15000);
  });

  it("on a new entry sends numbers, never the NaN of an empty box, for every figure", async () => {
    cleanup();
    api.mockReset();
    api.mockImplementation(async (_p: string, method = "GET") =>
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
    await user.selectOptions(screen.getByRole("combobox", { name: "Ward" }), "Ward 4");
    await user.click(screen.getByRole("button", { name: /Set zero activity/ }));
    await user.click(screen.getByRole("button", { name: /submit entry/i }));
    await waitFor(() =>
      expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(true),
    );
    // NaN would serialize to null, which the API rejects with a 422.
    const wire = JSON.parse(
      JSON.stringify(api.mock.calls.find((c) => c[1] === "POST")![2].input),
    );
    for (const k of [
      "received", "completed", "slaWithinTime", "amountPaise",
      "complaintsReceived", "complaintsResolved", "fieldReceived", "fieldCompleted",
    ])
      expect(wire[k], k).toBe(0);
    expect(wire.nothingToReport).toBe(true);
    expect(wire.ward).toBe("Ward 4");
  });
});
