import { describe, expect, it } from "vitest";
import { DAILY_SERVICES, displayNumber } from "../../src/domain/daily-entry-order";
import { FIELD_WORK_IDS, OFFERED_IDS, WITHDRAWN_IDS, servicePosition } from "../ui/service-position";

// The dashboard numbers services the way the entry form does. Both are held
// against the oracle typed by hand in tests/ui/service-position.ts.
describe("the daily entry's order, as the dashboard uses it", () => {
  it("lists the ten in the entry form's order", () => {
    expect(DAILY_SERVICES.map((s) => s.id)).toEqual(OFFERED_IDS);
  });

  it("numbers each as the entry form prints it", () => {
    for (const id of OFFERED_IDS) expect(displayNumber(id), `service ${id}`).toBe(servicePosition(id));
  });

  it("has no number for a service that is not on the daily entry", () => {
    for (const id of [...FIELD_WORK_IDS, ...WITHDRAWN_IDS]) expect(() => displayNumber(id), `service ${id}`).toThrow();
  });
});
