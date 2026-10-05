import { describe, it, expect } from "vitest";
import { auditComparison } from "../../src/client/audit";
describe("readable audit comparisons", () => {
  it("ignores metadata and derived balances absent from the old snapshot", () => {
    const before = { serviceId: 1, received: 0, version: 1 };
    expect(
      auditComparison(
        JSON.stringify(before),
        JSON.stringify({
          ...before,
          version: 2,
          updatedAt: "later",
          opening: { service: 10 },
          closing: { service: 10 },
        }),
      ).changes,
    ).toEqual([]);
  });
  it("shows only changed entered fields", () => {
    expect(
      auditComparison(
        '{"received":6,"ward":"Ward 1"}',
        '{"received":7,"ward":"Ward 1"}',
      ).changes,
    ).toEqual([{ key: "received", before: 6, after: 7 }]);
  });
  it("compares opening balances by service rather than array position", () => {
    const before = {
      balances: [
        { serviceId: 1, opening: { service: 10, complaints: 3, field: 5 } },
      ],
    };
    const after = {
      balances: [
        { serviceId: 1, opening: { service: 12, complaints: 3, field: 5 } },
      ],
    };
    expect(
      auditComparison(JSON.stringify(before), JSON.stringify(after)).changes,
    ).toEqual([
      { key: "opening.service", serviceId: 1, before: 10, after: 12 },
    ]);
  });
  it("handles damaged snapshots without crashing", () => {
    expect(auditComparison(null, "invalid").valid).toBe(false);
  });
});
