import { describe, it, expect } from "vitest";
import { auditComparison, auditFields, auditValue } from "../../src/client/audit";
import { runtimeText } from "../../src/client/i18n";
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
  // nothingToReport was added after the first entries were filed, so a snapshot
  // written before it has no such key at all.
  it("does not grow a nothing-to-report row when a pre-cutover entry is corrected", () => {
    expect(
      auditComparison(
        '{"received":5,"ward":"Ward 1"}',
        '{"received":6,"ward":"Ward 1","nothingToReport":false}',
      ).changes,
    ).toEqual([{ key: "received", before: 5, after: 6 }]);
  });
  it("reports a real change of the nothing-to-report flag", () => {
    expect(
      auditComparison('{"nothingToReport":false}', '{"nothingToReport":true}')
        .changes,
    ).toEqual([{ key: "nothingToReport", before: false, after: true }]);
    expect(
      auditComparison('{"received":2}', '{"received":2,"nothingToReport":true}')
        .changes,
    ).toEqual([{ key: "nothingToReport", before: false, after: true }]);
  });
  it("says nothing about a submission that had something to report", () => {
    expect(
      auditComparison(null, '{"received":5,"nothingToReport":false}').changes,
    ).toEqual([{ key: "received", before: undefined, after: 5 }]);
  });
  it("names and renders the nothing-to-report flag for a reader", () => {
    expect(auditFields.nothingToReport?.[0]).toBe("Nothing to report");
    expect(auditFields.nothingToReport?.[1]).toBeTruthy();
    expect(auditValue("nothingToReport", true, "en")).toBe("Yes");
    expect(auditValue("nothingToReport", false, "en")).toBe("No");
    expect(auditValue("nothingToReport", false, "hi")).toBe("नहीं");
  });
  it("translates the server's nothing-to-report rejection", () => {
    // The literal is a cross-repo contract: byte-identical to the string in
    // MonitoringRules.ValidateEntry, or the Hindi reader sees English.
    expect(
      runtimeText(
        "Nothing to report cannot be combined with reported figures",
        "hi",
      ),
    ).toBe("कुछ रिपोर्ट नहीं के साथ कोई आंकड़ा दर्ज नहीं किया जा सकता");
  });
  it("handles damaged snapshots without crashing", () => {
    expect(auditComparison(null, "invalid").valid).toBe(false);
  });
});
