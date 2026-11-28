import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import services from "../../src/shared/services.json";
import { collectedFields, collects, formShape, collectsWorkDone, dailyEntryCollects, movesPendingBalance, serviceKind, KNOWN_UNITS } from "../../src/domain/service-kind";

describe("what kind of work a service is", () => {
  // From the Service Master's Primary Monitoring Unit column, not hand-listed:
  // 8 door-to-door vehicle, 9 fogging, 10 street dog, 13 street lighting,
  // 14 road and drain, 15 grass cutting, 16 tree pruning, 17 water bodies.
  it("finds the eight services that are work on the ground", () => {
    const found = services.map((s) => s.id).filter(collectsWorkDone);
    expect(found).toEqual([8, 9, 10, 13, 14, 15, 16, 17]);
  });

  // The server's MonitoringRules.IsFieldWork is a shape test; this side asks
  // what is collected. They must name the same services or workDone differs.
  it("names the same services as the field-work shape, which the server tests", () => {
    for (const { id } of services)
      expect(collectsWorkDone(id), `service ${id}`).toBe(formShape(id) === "fieldwork");
  });

  it("finds the three that only collect money", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "revenue");
    expect(found).toEqual([2, 5, 6]);
  });

  it("finds the one that is pure grievance handling", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "grievance");
    expect(found).toEqual([12]);
  });

  it("finds the four that collect a queue and money together", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "counterRevenue");
    expect(found).toEqual([1, 3, 4, 7]);
  });

  it("leaves nine as counter work", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "counter");
    expect(found).toHaveLength(9);
  });

  // If someone edits a unit string in services.json, the service silently
  // becomes counter work and the strict rules come back. This catches that.
  it("recognises every unit present in the service master", () => {
    const unknown = services.filter((s) => !KNOWN_UNITS.includes(s.unit));
    expect(unknown.map((s) => `${s.id} ${s.unit}`)).toEqual([]);
  });

  it("treats an unknown service id as counter work, keeping the strict rules", () => {
    expect(serviceKind(99)).toBe("counter");
    expect(collectsWorkDone(99)).toBe(false);
  });

  it("puts the grievance service on the counter shape", () => {
    expect(formShape(12)).toBe("counter");
    expect(movesPendingBalance(12)).toBe(true);
  });

  it("gives counter 10, counterRevenue 4, revenue 3, fieldwork 8", () => {
    const n = (s: string) => services.filter((x) => formShape(x.id) === s).length;
    expect([n("counter"), n("counterRevenue"), n("revenue"), n("fieldwork")]).toEqual([10, 4, 3, 8]);
  });

  it("moves the balance for the counter shapes, counterRevenue included", () => {
    expect(services.map((s) => s.id).filter(movesPendingBalance)).toEqual(
      [1, 3, 4, 7, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25]);
  });

  // The two numbers each shape asks for. A cross-field rule applies only where
  // both its operands are in here; mirrors MonitoringRules.CollectedFields.
  it("collects only what its shape asks for", () => {
    expect(collectedFields(11)).toEqual(["received", "completed"]);
    expect(collectedFields(1)).toEqual(["received", "completed", "amountPaise"]);
    expect(collectedFields(2)).toEqual(["received", "amountPaise"]);
    expect(collectedFields(15)).toEqual(["completed"]);
  });

  it("needs both operands collected before a rule can apply", () => {
    expect(collects(1, "completed", "received")).toBe(true);
    expect(collects(11, "completed", "received")).toBe(true);
    expect(collects(2, "completed", "received")).toBe(false);
    expect(collects(15, "completed", "received")).toBe(false);
    for (const id of [1, 2, 11, 15])
      expect(collects(id, "slaWithinTime", "completed")).toBe(false);
  });

  // The fourth shape: a queue and money together. Ids 1, 3, 4 and 7.
  it.each([1, 3, 4, 7])("puts service %i on the counterRevenue shape", (id) => {
    expect(formShape(id)).toBe("counterRevenue");
    expect(collectedFields(id)).toEqual(["received", "completed", "amountPaise"]);
    expect(movesPendingBalance(id)).toBe(true);
    expect(collects(id, "completed", "received")).toBe(true);
    expect(collects(id, "amountPaise")).toBe(true);
  });

  it("leaves every other service on the shape it had", () => {
    const shapeOf = (ids: number[]) => ids.map(formShape);
    expect(shapeOf([11, 12])).toEqual(["counter", "counter"]);
    expect(shapeOf([2, 5, 6])).toEqual(["revenue", "revenue", "revenue"]);
    expect(shapeOf([8, 9, 10, 13, 14, 15, 16, 17]).every((s) => s === "fieldwork")).toBe(true);
    expect(shapeOf([18, 19, 20, 21, 22, 23, 24, 25]).every((s) => s === "counter")).toBe(true);
  });
});

// Mirrors the server's DailyEntryCollects(id) => !IsFieldWork(id). The expected
// sets are written out here on purpose: they are the oracle the derivation is
// held against, not something the derivation may be copied from.
describe("which services the daily entry collects", () => {
  it("collects the seventeen that are not field work", () => {
    const found = services.map((s) => s.id).filter(dailyEntryCollects);
    expect(found).toEqual([1, 2, 3, 4, 5, 6, 7, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25]);
  });

  it("does not collect the eight that are reported as visits", () => {
    for (const id of [8, 9, 10, 13, 14, 15, 16, 17]) expect(dailyEntryCollects(id), `service ${id}`).toBe(false);
  });

  it("leaves the field-work shape in place, so a filed entry stays readable", () => {
    for (const id of [8, 9, 10, 13, 14, 15, 16, 17]) {
      expect(formShape(id)).toBe("fieldwork");
      expect(collectedFields(id)).toEqual(["completed"]);
    }
  });

  // A literal list of the eight is behaviourally correct today and drifts the day
  // a service changes shape, so no behavioural test can catch it. The whole of src
  // is scanned for one in derive-dont-list.test.ts; this pins that the predicate
  // itself is the shape test, to the function's closing brace, not its first `}`.
  it("derives the rule from the shape and spells out no service id", () => {
    const source = readFileSync(new URL("../../src/domain/service-kind.ts", import.meta.url), "utf8");
    const body = source.match(/export function dailyEntryCollects\([^)]*\)[^{]*\{([\s\S]*?)\n\}/)?.[1];
    expect(body, "dailyEntryCollects not found").toBeDefined();
    expect(body).toContain("formShape(");
    expect(body).not.toMatch(/\d/);
  });
});
