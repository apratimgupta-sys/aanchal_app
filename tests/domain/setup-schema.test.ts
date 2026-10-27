import { describe, expect, it } from "vitest";
import { balanceSchema } from "../../src/client/pages/InitialBalances";
import { todayIST } from "../../src/domain/ledger";

const balances = (service = 0) =>
  Array.from({ length: 25 }, (_, i) => ({
    serviceId: i + 1,
    opening: { service: i === 0 ? service : 0, complaints: 0, field: 0 },
  }));
const form = (over: Record<string, unknown> = {}) => ({
  date: todayIST(),
  confirmed: true,
  balances: balances(),
  ...over,
});
const messages = (value: unknown) => {
  const parsed = balanceSchema.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe("setup form schema", () => {
  it("accepts today and a past date", () => {
    expect(balanceSchema.safeParse(form()).success).toBe(true);
    expect(balanceSchema.safeParse(form({ date: "2026-10-01" })).success).toBe(true);
  });

  it("rejects a future start date even when the input max is bypassed", () => {
    expect(messages(form({ date: "2999-01-01" }))).toContain(
      "Reporting start date cannot be in the future",
    );
  });

  it("rejects blank and impossible dates", () => {
    expect(messages(form({ date: "" })).length).toBeGreaterThan(0);
    expect(messages(form({ date: "2026-02-30" }))).toContain("Enter a valid date");
  });

  it("rejects negative, fractional, over-limit and empty balances", () => {
    for (const bad of [-5, 1.5, 1_000_000_001, Number.NaN]) {
      expect(messages(form({ balances: balances(bad) })).length).toBeGreaterThan(0);
    }
    expect(balanceSchema.safeParse(form({ balances: balances(1_000_000_000) })).success).toBe(true);
  });

  it("requires the confirmation", () => {
    expect(messages(form({ confirmed: false }))).toContain(
      "Please confirm the opening balances",
    );
  });
});
