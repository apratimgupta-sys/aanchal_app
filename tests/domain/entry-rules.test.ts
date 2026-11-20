import { describe, expect, it } from "vitest";
import { avgDisposalDaysRequired, entryCrossFieldErrors } from "../../src/domain/entry-rules";
import { applyActivity } from "../../src/domain/ledger";

const zero = {
  received: 0, completed: 0, slaWithinTime: 0,
  complaintsReceived: 0, complaintsResolved: 0,
  fieldReceived: 0, fieldCompleted: 0, amountPaise: 0,
};

describe("cross-field rules on a daily entry", () => {
  // Grass cutting (15) is work on the ground. Five sites can be cut without
  // five requests arriving first; the old rule made that unrecordable.
  it("lets work on the ground exceed what was requested", () => {
    expect(entryCrossFieldErrors(15, { ...zero, completed: 5 })).toEqual({});
  });

  it("still stops counter work finishing more than it received", () => {
    expect(entryCrossFieldErrors(1, { ...zero, completed: 5 })).toEqual({
      completed: "Completed cannot exceed received",
    });
  });

  it("keeps the within-SLA rule everywhere, since it compares like with like", () => {
    expect(entryCrossFieldErrors(15, { ...zero, completed: 2, slaWithinTime: 3 })).toEqual({
      slaWithinTime: "Within-SLA completions cannot exceed completed",
    });
  });

  it("reports every broken rule at once, not just the first", () => {
    const errors = entryCrossFieldErrors(1, {
      ...zero, completed: 5, complaintsResolved: 2, fieldCompleted: 3,
    });
    expect(Object.keys(errors).sort()).toEqual([
      "complaintsResolved", "completed", "fieldCompleted",
    ]);
  });
});

describe("when average disposal days is required", () => {
  it("is not required for work on the ground, which disposes of nothing", () => {
    expect(avgDisposalDaysRequired(15, 5)).toBe(false);
  });

  it("is required for counter work that finished something", () => {
    expect(avgDisposalDaysRequired(1, 5)).toBe(true);
  });

  it("is not required when nothing was finished", () => {
    expect(avgDisposalDaysRequired(1, 0)).toBe(false);
  });
});

describe("the pending balance", () => {
  // applyActivity is the frontend's copy of MonitoringRules.Derive. Field work
  // must not move the service balance there either, or the form shows a
  // negative closing figure the server would reject.
  it("does not move for work on the ground", () => {
    const after = applyActivity(
      { service: 0, complaints: 0, field: 0 },
      { ...zero, serviceId: 15, completed: 5 },
    );
    expect(after.service).toBe(0);
  });

  it("leaves an existing balance untouched for work on the ground", () => {
    const after = applyActivity(
      { service: 7, complaints: 0, field: 0 },
      { ...zero, serviceId: 15, received: 2, completed: 5 },
    );
    expect(after.service).toBe(7);
  });

  it("still moves for counter work", () => {
    const after = applyActivity(
      { service: 0, complaints: 0, field: 0 },
      { ...zero, serviceId: 1, received: 5, completed: 2 },
    );
    expect(after.service).toBe(3);
  });
});
