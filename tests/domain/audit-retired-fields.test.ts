import { describe, expect, it } from "vitest";
import { auditComparison, auditFields } from "../../src/client/audit";

describe("the audit labels for retired fields", () => {
  it("keeps the correction history labels for the retired fields", async () => {
    // audit.ts is unchanged: a pre-cutover entry keeps its stored complaint, field
    // and SLA figures, and a correction to one must still render with a label.
    for (const key of [
      "slaWithinTime",
      "complaintsReceived",
      "complaintsResolved",
      "fieldReceived",
      "fieldCompleted",
      "avgDisposalDays",
    ]) {
      expect(auditFields[key]?.[0]).toBeTruthy();
      expect(auditFields[key]?.[1]).toBeTruthy();
    }
    expect(
      auditComparison(
        '{"complaintsReceived":3,"complaintsResolved":1}',
        '{"complaintsReceived":4,"complaintsResolved":1}',
      ).changes,
    ).toEqual([{ key: "complaintsReceived", before: 3, after: 4 }]);
  });
});
