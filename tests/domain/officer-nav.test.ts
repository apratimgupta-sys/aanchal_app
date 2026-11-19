import { describe, expect, it } from "vitest";
import { officerNav } from "../../src/client/components/AppShell";
import {
  OFFICER_VISITS_ROUTE,
  OFFICER_VISIT_ROUTE,
} from "../../src/client/officer-routes";

describe("officerNav", () => {
  it("offers the visit form and the officer's own visits, in that order", () => {
    const items = officerNav({ visit: "Record a visit", mine: "My visits" });
    expect(items.map((item) => item.href)).toEqual([
      OFFICER_VISIT_ROUTE,
      OFFICER_VISITS_ROUTE,
    ]);
    expect(items.map((item) => item.label)).toEqual(["Record a visit", "My visits"]);
  });

  it("gives every item an icon, so the mobile rail is not blank", () => {
    for (const item of officerNav({ visit: "a", mine: "b" })) {
      expect(item.icon).toBeTruthy();
    }
  });
});
