import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectedFields, formShape, movesPendingBalance } from "../../src/domain/service-kind";
import fixture from "./shape-twin.fixture.json";

// The shape tables are a hand-maintained twin of MonitoringRules in the backend
// repo. This golden table is committed identically in both repos, and each side
// asserts its own tables against it, so neither can change a shape or reorder a
// collected field without a test going red. The backend's copy is
// backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json
// and its test is CounterRevenueShapeTests.TheShapeTablesMatchTheGoldenTwinFixture.
const entries = Object.entries(fixture.shapes) as [
  string,
  { shape: string; collected: string[]; movesPendingBalance: boolean },
][];

describe("the shape tables against the golden twin table", () => {
  it("covers the four counterRevenue ids", () => {
    expect(entries.filter(([, e]) => e.shape === "counterRevenue").map(([id]) => Number(id)).sort()).toEqual([1, 3, 4, 7]);
  });

  it.each(entries)("service %s matches in shape, collected fields and order, and balance", (id, e) => {
    expect(formShape(Number(id))).toBe(e.shape);
    expect([...collectedFields(Number(id))]).toEqual(e.collected);
    expect(movesPendingBalance(Number(id))).toBe(e.movesPendingBalance);
  });

  // Where the backend repo is checked out beside this one, the two copies of the
  // table must be byte-identical. Skipped (not passed) when it is not there.
  const backendCopy = new URL(
    "../../../backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json",
    import.meta.url,
  );
  it.skipIf(!existsSync(backendCopy))("is byte-identical to the backend repo's copy", () => {
    const here = readFileSync(new URL("./shape-twin.fixture.json", import.meta.url), "utf8");
    expect(readFileSync(backendCopy, "utf8")).toBe(here);
  });
});
