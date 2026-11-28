import { describe, it, expect } from "vitest";
import {
  applyActivity,
  deriveEntryViews,
  validateEntry,
  parseMoney,
} from "../../src/domain/ledger";
const activity = {
  received: 2,
  completed: 4,
  slaWithinTime: 4,
  amountPaise: 0,
  complaintsReceived: 1,
  complaintsResolved: 2,
  fieldReceived: 0,
  fieldCompleted: 1,
};
const entry = {
  ...activity,
  id: "a",
  officeId: 1,
  version: 1,
  serviceDate: "2026-10-01",
  reportingDate: "2026-10-03",
  serviceId: 1,
  ward: "Ward 1",
  avgDisposalDays: 2,
  remarks: "",
  createdAt: "",
  updatedAt: "",
};
describe("ledger", () => {
  it("carries all three balances", () =>
    expect(
      applyActivity({ service: 10, complaints: 3, field: 5 }, activity),
    ).toEqual({ service: 8, complaints: 2, field: 4 }));
  it("recalculates through skipped dates and rejects negative later balance", () => {
    const next = {
      ...entry,
      id: "b",
      serviceDate: "2026-10-03",
      received: 0,
      completed: 8,
      slaWithinTime: 0,
      complaintsResolved: 0,
      fieldCompleted: 0,
    };
    expect(
      deriveEntryViews({ service: 10, complaints: 3, field: 5 }, [
        entry,
        next,
      ])[1].opening.service,
    ).toBe(8);
    expect(() =>
      deriveEntryViews({ service: 10, complaints: 3, field: 5 }, [
        { ...entry, completed: 5 },
        next,
      ]),
    ).toThrow("2026-10-03");
  });
  // Dropped: { completed: 1 }. It was invalid only because the fixture's
  // slaWithinTime of 4 exceeded it, and that rule no longer applies — no shape
  // collects slaWithinTime, so it cannot refuse an entry (see
  // entry-rules.test.ts "a rule on a field no shape collects").
  it.each([
    { received: 1.2 },
    { amountPaise: -1 },
    { serviceDate: "2026-02-30" },
    { serviceDate: "2026-10-04" },
    { ward: "" },
    { ward: "11" },
    { ward: "Ward 54" },
  ])("rejects invalid input %j", (patch) =>
    expect(validateEntry({ ...entry, ...patch }, "2026-10-03")).not.toBeNull(),
  );
  // The positive form of the dropped case above: the stored within-SLA figure
  // of 4 must not refuse a correction that lowers completed to 1.
  it("accepts a lowered completed figure beside a stored within-SLA figure", () =>
    expect(validateEntry({ ...entry, completed: 1 }, "2026-10-03")).toBeNull());
  it("accepts a completed entry that carries no average disposal days", () =>
    expect(
      validateEntry(
        { ...entry, received: 5, completed: 3, slaWithinTime: 0, avgDisposalDays: null },
        "2026-10-03",
      ),
    ).toBeNull());
  it.each([-1, 100001, NaN, Infinity])(
    "still rejects a supplied average of %s",
    (avgDisposalDays) =>
      expect(
        validateEntry(
          { ...entry, received: 5, completed: 3, slaWithinTime: 0, avgDisposalDays },
          "2026-10-03",
        )?.fieldErrors?.avgDisposalDays,
      ).toBeDefined(),
  );
  it("parses paise exactly", () => {
    expect(parseMoney("1.01")).toBe(101);
    expect(() => parseMoney("1.001")).toThrow();
  });
});
