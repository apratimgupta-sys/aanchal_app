import { describe, expect, it } from "vitest";
import services from "../../src/shared/services.json";
import { isFieldWork, serviceKind, KNOWN_UNITS } from "../../src/domain/service-kind";

describe("what kind of work a service is", () => {
  // From the Service Master's Primary Monitoring Unit column, not hand-listed:
  // 8 door-to-door vehicle, 9 fogging, 10 street dog, 13 street lighting,
  // 14 road and drain, 15 grass cutting, 16 tree pruning, 17 water bodies.
  it("finds the eight services that are work on the ground", () => {
    const found = services.map((s) => s.id).filter(isFieldWork);
    expect(found).toEqual([8, 9, 10, 13, 14, 15, 16, 17]);
  });

  it("finds the three that only collect money", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "revenue");
    expect(found).toEqual([2, 5, 6]);
  });

  it("finds the one that is pure grievance handling", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "grievance");
    expect(found).toEqual([12]);
  });

  it("leaves thirteen as counter work", () => {
    const found = services.map((s) => s.id).filter((id) => serviceKind(id) === "counter");
    expect(found).toHaveLength(13);
  });

  // If someone edits a unit string in services.json, the service silently
  // becomes counter work and the strict rules come back. This catches that.
  it("recognises every unit present in the service master", () => {
    const unknown = services.filter((s) => !KNOWN_UNITS.includes(s.unit));
    expect(unknown.map((s) => `${s.id} ${s.unit}`)).toEqual([]);
  });

  it("treats an unknown service id as counter work, keeping the strict rules", () => {
    expect(serviceKind(99)).toBe("counter");
    expect(isFieldWork(99)).toBe(false);
  });
});
