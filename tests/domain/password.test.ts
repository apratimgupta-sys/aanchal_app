import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validatePasswordChange } from "../../src/domain/password";

const CURRENT = "Anchal@1@2026";

describe("validatePasswordChange", () => {
  it("accepts a different password of sufficient length, typed twice", () => {
    expect(validatePasswordChange(CURRENT, "Kadru#2026je", "Kadru#2026je")).toEqual({});
  });

  it("requires the current password", () => {
    expect(validatePasswordChange("", "Kadru#2026je", "Kadru#2026je")).toHaveProperty("currentPassword");
  });

  it("rejects a new password below the minimum length", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePasswordChange(CURRENT, short, short)).toHaveProperty("newPassword");
  });

  it("accepts a new password at exactly the minimum length", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validatePasswordChange(CURRENT, exact, exact)).toEqual({});
  });

  it("rejects a new password identical to the current one", () => {
    expect(validatePasswordChange(CURRENT, CURRENT, CURRENT)).toHaveProperty("newPassword");
  });

  it("rejects a confirmation that does not match", () => {
    expect(validatePasswordChange(CURRENT, "Kadru#2026je", "Kadru#2026JE")).toHaveProperty("confirmPassword");
  });

  it("does not trim the password, since spaces are part of it", () => {
    const spaced = " Kadru#2026je ";
    expect(validatePasswordChange(CURRENT, spaced, spaced)).toEqual({});
    expect(validatePasswordChange(CURRENT, spaced, spaced.trim())).toHaveProperty("confirmPassword");
  });

  it("reports every broken field at once", () => {
    expect(Object.keys(validatePasswordChange("", "x", "y")).sort()).toEqual([
      "confirmPassword",
      "currentPassword",
      "newPassword",
    ]);
  });
});
