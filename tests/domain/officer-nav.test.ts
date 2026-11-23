import { describe, expect, it } from "vitest";
import { commissionerNav, officerNav, roleManagerNav } from "../../src/client/components/AppShell";
import { adminLanding } from "../../src/client/role-routes";
import type { UserSession } from "../../src/shared/types";
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

describe("commissionerNav", () => {
  it("offers the dashboard and the field visit register, in that order", () => {
    const items = commissionerNav({
      dashboard: "Dashboard",
      visits: "Field visits",
    });
    expect(items.map((item) => item.href)).toEqual([
      "/commissioner/dashboard",
      "/commissioner/visits",
    ]);
  });

  it("has no entry for user administration", () => {
    const items = commissionerNav({ dashboard: "a", visits: "b" });
    expect(items.some((item) => /officers|rolemanager|users/.test(item.href))).toBe(false);
  });
});

describe("roleManagerNav", () => {
  it("offers user administration and nothing else", () => {
    expect(roleManagerNav({ users: "Users" }).map((item) => item.href)).toEqual(["/rolemanager/users"]);
  });
});

const session = (role: UserSession["role"]): UserSession => ({
  userId: "u", username: "u", role, officeId: null, expiresAt: 0,
});

describe("adminLanding", () => {
  it("lands a role manager on user administration from anywhere", () => {
    expect(adminLanding(session("rolemanager"), "/")).toBe("/rolemanager/users");
    expect(adminLanding(session("rolemanager"), "/commissioner/dashboard")).toBe("/rolemanager/users");
    expect(adminLanding(session("rolemanager"), "/rolemanager/users")).toBeNull();
  });

  it("has no route for a commissioner to user administration, old or new", () => {
    for (const path of ["/rolemanager/users", "/commissioner/officers", "/"])
      expect(adminLanding(session("commissioner"), path)).toBe("/commissioner/dashboard");
    expect(adminLanding(session("commissioner"), "/commissioner/visits")).toBeNull();
  });

  it("is not the business of an office or officer session", () => {
    expect(adminLanding(session("office"), "/x")).toBeNull();
    expect(adminLanding(session("officer"), "/x")).toBeNull();
  });
});
