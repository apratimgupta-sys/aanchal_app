import { describe, expect, it } from "vitest";
import { officerLanding } from "../../src/client/officer-routes";
import type { OfficerProfile, UserSession } from "../../src/shared/types";

const officerProfile: OfficerProfile = {
  id: "off-1",
  username: "je.kadru",
  name: "A. Kumar",
  designation: "Junior Engineer",
  homeOfficeId: 3,
  active: true,
};

function officerSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    userId: "off-1",
    username: "je.kadru",
    role: "officer",
    officeId: null,
    expiresAt: 0,
    officer: officerProfile,
    ...overrides,
  };
}

describe("officerLanding", () => {
  it("sends an officer at the portal root to the visit form", () => {
    expect(officerLanding(officerSession(), "/")).toBe("/officer/visit");
  });

  it("leaves an officer on their own visit list alone", () => {
    expect(officerLanding(officerSession(), "/officer/visits")).toBeNull();
  });

  it("leaves an officer on the visit form alone", () => {
    expect(officerLanding(officerSession(), "/officer/visit")).toBeNull();
  });

  it("sends an officer away from commissioner and office routes", () => {
    expect(officerLanding(officerSession(), "/commissioner/dashboard")).toBe("/officer/visit");
    expect(officerLanding(officerSession(), "/office/today")).toBe("/officer/visit");
  });

  it("sends an officer on an unknown route to the visit form", () => {
    expect(officerLanding(officerSession(), "/nonsense")).toBe("/officer/visit");
  });

  it("holds an officer who must change their password on the password page", () => {
    const session = officerSession({ mustChangePassword: true });
    expect(officerLanding(session, "/officer/visit")).toBe("/officer/password");
    expect(officerLanding(session, "/officer/visits")).toBe("/officer/password");
    expect(officerLanding(session, "/officer/password")).toBeNull();
  });

  it("lets an officer visit the password page voluntarily", () => {
    expect(officerLanding(officerSession(), "/officer/password")).toBeNull();
  });

  it("leaves office and commissioner sessions to the existing rules", () => {
    const office: UserSession = {
      userId: "o-3", username: "anchal3", role: "office", officeId: 3, expiresAt: 0,
    };
    const commissioner: UserSession = {
      userId: "c-1", username: "commissioner", role: "commissioner", officeId: null, expiresAt: 0,
    };
    expect(officerLanding(office, "/office/today")).toBeNull();
    expect(officerLanding(office, "/officer/visit")).toBeNull();
    expect(officerLanding(commissioner, "/commissioner/dashboard")).toBeNull();
  });
});
