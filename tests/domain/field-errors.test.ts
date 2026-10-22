import { describe, expect, it } from "vitest";
import {
  normalizeFieldErrors,
  setupErrorTarget,
} from "../../src/client/field-errors";

describe("normalizeFieldErrors", () => {
  it("strips the server's input. prefix so errors land on the form fields", () => {
    expect(
      normalizeFieldErrors({
        "input.received": "Enter a valid value",
        ward: "Enter ward number/name (maximum 200 characters)",
      }),
    ).toEqual({
      received: "Enter a valid value",
      ward: "Enter ward number/name (maximum 200 characters)",
    });
  });

  it("returns an empty object when there are no field errors", () => {
    expect(normalizeFieldErrors(undefined)).toEqual({});
    expect(normalizeFieldErrors(null)).toEqual({});
  });
});

describe("setupErrorTarget", () => {
  it("maps the start date error to the date field", () => {
    expect(setupErrorTarget("startDate")).toBe("date");
  });

  it("maps balance paths to the matching table cell", () => {
    expect(setupErrorTarget("balances[0].opening.service")).toBe(
      "balances.0.opening.service",
    );
    expect(setupErrorTarget("balances[24].opening.field")).toBe(
      "balances.24.opening.field",
    );
  });

  it("ignores keys that do not belong to a visible field", () => {
    expect(setupErrorTarget("body")).toBeNull();
    expect(setupErrorTarget("balances")).toBeNull();
    expect(setupErrorTarget("balances[1].opening.other")).toBeNull();
  });
});
