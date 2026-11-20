import { describe, it, expect } from "vitest";
import {
  applyActivity,
  deriveEntryViews,
  validateEntry,
  parseMoney,
  summarizePeriod,
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
  ward: "1",
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
  it("totals flows but takes closing stocks and handles no denominator", () => {
    const setup = {
      officeId: 1,
      startDate: "2026-10-01",
      version: 1,
      balances: Array.from({ length: 25 }, (_, i) => ({
        serviceId: i + 1,
        opening: {
          service: i === 0 ? 10 : 0,
          complaints: i === 0 ? 3 : 0,
          field: i === 0 ? 5 : 0,
        },
      })),
    };
    const rows = summarizePeriod(
      [setup],
      [entry],
      { from: "2026-10-01", to: "2026-10-03" },
      "2026-10-03",
    );
    expect(rows[0]).toMatchObject({
      pending: 8,
      disposalPct: 200,
      submitted: 1,
      expected: 75,
    });
    expect(rows[1].disposalPct).toBeNull();
    expect(rows[1].expected).toBe(0);
  });
});
// The server scopes Received, Completed and Within-SLA to counter work
// (MonitoringService.GetDashboardAsync), because a payment completes nothing
// and field work completes against a Received of 0 — summing them in pushes
// Disposal % past 100. This mirror has to agree, or it reports a different
// dashboard from the one the commissioner sees.
it("counts received, completed and within-SLA for counter work only", () => {
  const setup = {
    officeId: 1,
    startDate: "2026-10-01",
    version: 1,
    balances: Array.from({ length: 25 }, (_, i) => ({
      serviceId: i + 1,
      opening: { service: 0, complaints: 0, field: 0 },
    })),
  };
  const at = (serviceId: number, over: Partial<typeof entry> = {}) => ({
    ...entry,
    id: `e${serviceId}`,
    serviceId,
    received: 0,
    completed: 0,
    slaWithinTime: 0,
    complaintsReceived: 0,
    complaintsResolved: 0,
    fieldReceived: 0,
    fieldCompleted: 0,
    ...over,
  });
  const r = summarizePeriod(
    [setup],
    [
      at(1, { received: 9, completed: 4, slaWithinTime: 3 }), // counter
      at(2, { received: 12, amountPaise: 500 }), // revenue: payments, not cases
      at(8, { completed: 6 }), // field work: trips, not disposals
    ],
    { from: "2026-10-01", to: "2026-10-03" },
    "2026-10-03",
  )[0];
  expect(r.received).toBe(9);
  expect(r.completed).toBe(4);
  expect(r.slaWithinTime).toBe(3);
  // Field work keeps its own figure, and money is collected from every shape.
  expect(r.workDone).toBe(6);
  expect(r.amountPaise).toBe(500);
  // 4/9, not 10/21: the ratio only means something over counter work.
  expect(r.disposalPct).toBeCloseTo((4 / 9) * 100);
  expect(r.submitted).toBe(3);
});
it("preserves zero denominators and strict review thresholds", () => {
  const setup = {
    officeId: 1,
    startDate: "2026-10-01",
    version: 1,
    balances: Array.from({ length: 25 }, (_, i) => ({
      serviceId: i + 1,
      opening: {
        service: i === 0 ? 10 : 0,
        complaints: i === 0 ? 5 : 0,
        field: i === 0 ? 10 : 0,
      },
    })),
  };
  const r = summarizePeriod(
    [setup],
    [],
    { from: "2026-09-30", to: "2026-10-01" },
    "2026-10-03",
  )[0];
  expect(r.expected).toBe(25);
  expect(r.reviewReasons).toEqual([]);
  expect(r.slaPct).toBeNull();
});
