import { describe, expect, it } from "vitest";
import { entryCrossFieldErrors, isCanonicalWard, WARD_COUNT } from "../../src/domain/entry-rules";
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

  // Deleted with the rules they asserted, not weakened:
  //   "keeps the within-SLA rule everywhere, since it compares like with like"
  //     — its premise is the one the review overturned. No shape collects
  //       slaWithinTime, so the rule can only refuse an entry on a field the
  //       office cannot see.
  //   "reports every broken rule at once, not just the first"
  //     — three of the four cross-field rules are gone, so there is no longer a
  //       plural to report. The surviving rule is covered above, and the form
  //       still aggregates ward and figure errors together (daily-entry tests).

  // A rule applies only where the shape collects both operands, so a
  // pre-cutover entry's retired figures can never block a correction to the
  // figure the office can see. Mirrors MonitoringRules.Collects on the server.
  it.each([1, 2, 15])("a rule on a field no shape collects: service %i", (serviceId) => {
    expect(
      entryCrossFieldErrors(serviceId, {
        ...zero,
        received: 7,
        completed: 1,
        slaWithinTime: 9,
        complaintsReceived: 2,
        complaintsResolved: 5,
        fieldReceived: 1,
        fieldCompleted: 4,
      }),
    ).toEqual({});
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

describe("revenue services and the pending balance", () => {
  const open = { service: 7, complaints: 0, field: 0 };

  it.each([2, 5, 6])("service %i: payments received leave the balance unchanged", (serviceId) => {
    const after = applyActivity(open, { ...zero, serviceId, received: 40 });
    expect(after.service).toBe(7);
  });

  it.each([1, 12, 25])("service %i: counter closing balance is unaffected", (serviceId) => {
    const after = applyActivity(open, { ...zero, serviceId, received: 40, completed: 15 });
    expect(after.service).toBe(32);
  });

  it("still moves for the grievance service (counter shape)", () => {
    const after = applyActivity(
      { service: 0, complaints: 0, field: 0 },
      { ...zero, serviceId: 12, received: 5, completed: 2 },
    );
    expect(after.service).toBe(3);
  });
});

// Break caught: the stored ward drifting from `Ward N` (one space, no leading
// zero, 1 to 53). The server enforces the same format; neither side keeps a list.
describe("the canonical ward", () => {
  it("covers 53 wards", () => expect(WARD_COUNT).toBe(53));

  it.each(["Ward 1", "Ward 11", "Ward 53"])("accepts %s", (ward) =>
    expect(isCanonicalWard(ward)).toBe(true),
  );

  it.each([
    "Ward 0", "Ward 54", "ward 11", "Ward 011", "Ward 11, Konka",
    "Ward  11", " Ward 11 ", "Ward 11 ", "11", "Ward", "", "Ward 1.5", "Ward ٣",
  ])("rejects %j", (ward) => expect(isCanonicalWard(ward)).toBe(false));

  it("rejects what is not a string", () => {
    expect(isCanonicalWard(undefined)).toBe(false);
    expect(isCanonicalWard(11)).toBe(false);
  });
});
