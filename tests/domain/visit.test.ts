import { describe, expect, it } from "vitest";
import {
  VERIFY_ACCURACY_METRES,
  VERIFY_WINDOW_MINUTES,
  WARD_MAX,
  validateVisitInput,
  verifyOnSite,
} from "../../src/domain/visit";
import { isCanonicalWard } from "../../src/domain/entry-rules";
import type { FieldVisitInput, GpsReading } from "../../src/shared/types";

const RECEIVED_AT = "2026-11-19T06:00:00.000Z";

function reading(overrides: Partial<GpsReading> = {}): GpsReading {
  return {
    latitude: 23.3441,
    longitude: 85.3096,
    accuracyMetres: 20,
    capturedAt: "2026-11-19T05:59:00.000Z",
    ...overrides,
  };
}

function minutesBefore(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) - minutes * 60_000).toISOString();
}

describe("verifyOnSite", () => {
  it("verifies a tight reading received straight away", () => {
    expect(verifyOnSite(reading(), RECEIVED_AT)).toEqual({ verified: true, reason: "ok" });
  });

  it("rejects a reading accurate only to kilometres", () => {
    expect(verifyOnSite(reading({ accuracyMetres: 5000 }), RECEIVED_AT)).toEqual({
      verified: false,
      reason: "accuracy",
    });
  });

  it("rejects a reading captured outside the window", () => {
    const capturedAt = minutesBefore(RECEIVED_AT, VERIFY_WINDOW_MINUTES + 1);
    expect(verifyOnSite(reading({ capturedAt }), RECEIVED_AT)).toEqual({
      verified: false,
      reason: "stale",
    });
  });

  it("accepts the accuracy and window boundaries", () => {
    const capturedAt = minutesBefore(RECEIVED_AT, VERIFY_WINDOW_MINUTES);
    expect(
      verifyOnSite(reading({ accuracyMetres: VERIFY_ACCURACY_METRES, capturedAt }), RECEIVED_AT),
    ).toEqual({ verified: true, reason: "ok" });
  });

  it("reports accuracy first when the reading is both coarse and stale", () => {
    const capturedAt = minutesBefore(RECEIVED_AT, VERIFY_WINDOW_MINUTES + 10);
    expect(verifyOnSite(reading({ accuracyMetres: 5000, capturedAt }), RECEIVED_AT)).toEqual({
      verified: false,
      reason: "accuracy",
    });
  });

  it("rejects a reading with a negative or non-finite accuracy", () => {
    expect(verifyOnSite(reading({ accuracyMetres: -1 }), RECEIVED_AT).reason).toBe("accuracy");
    expect(verifyOnSite(reading({ accuracyMetres: Number.NaN }), RECEIVED_AT).reason).toBe("accuracy");
  });

  it("tolerates a device clock running slightly ahead of the server", () => {
    const capturedAt = minutesBefore(RECEIVED_AT, -5);
    expect(verifyOnSite(reading({ capturedAt }), RECEIVED_AT)).toEqual({ verified: true, reason: "ok" });
  });

  it("rejects a device clock running far ahead of the server", () => {
    const capturedAt = minutesBefore(RECEIVED_AT, -(VERIFY_WINDOW_MINUTES + 1));
    expect(verifyOnSite(reading({ capturedAt }), RECEIVED_AT)).toEqual({
      verified: false,
      reason: "stale",
    });
  });

  it("rejects an unparseable capture timestamp", () => {
    expect(verifyOnSite(reading({ capturedAt: "not a date" }), RECEIVED_AT)).toEqual({
      verified: false,
      reason: "stale",
    });
  });
});

const TODAY = "2026-11-19";

function visit(overrides: Partial<FieldVisitInput> = {}): FieldVisitInput {
  return {
    visitDate: TODAY,
    visitTime: "10:30",
    officeId: 3,
    ward: 24,
    serviceId: 9,
    gps: reading(),
    issueAction: "Drain blocked near the school gate; cleaning crew to be sent tomorrow.",
    ...overrides,
  };
}

describe("the ward bound", () => {
  // Break caught: two constants for one municipal fact. The field-visit form and the
  // daily-entry format must agree on the last ward (also pinned in entry-rules.test.ts).
  it("is the one the daily entry format uses", () => {
    expect(validateVisitInput(visit({ ward: WARD_MAX }), TODAY)).not.toHaveProperty("ward");
    expect(validateVisitInput(visit({ ward: WARD_MAX + 1 }), TODAY)).toHaveProperty("ward");
    expect(isCanonicalWard(`Ward ${WARD_MAX}`)).toBe(true);
    expect(isCanonicalWard(`Ward ${WARD_MAX + 1}`)).toBe(false);
  });
});

describe("validateVisitInput", () => {
  it("accepts a complete visit for today", () => {
    expect(validateVisitInput(visit(), TODAY)).toEqual({});
  });

  it("rejects a visit date other than today", () => {
    expect(validateVisitInput(visit({ visitDate: "2026-11-18" }), TODAY)).toHaveProperty("visitDate");
    expect(validateVisitInput(visit({ visitDate: "2026-11-20" }), TODAY)).toHaveProperty("visitDate");
  });

  it("rejects a malformed visit date or time", () => {
    expect(validateVisitInput(visit({ visitDate: "19-11-2026" }), TODAY)).toHaveProperty("visitDate");
    expect(validateVisitInput(visit({ visitTime: "25:00" }), TODAY)).toHaveProperty("visitTime");
    expect(validateVisitInput(visit({ visitTime: "" }), TODAY)).toHaveProperty("visitTime");
  });

  it("rejects issue/action under 20 characters", () => {
    expect(validateVisitInput(visit({ issueAction: "ok" }), TODAY)).toHaveProperty("issueAction");
  });

  it("counts trimmed characters, so whitespace alone is not an observation", () => {
    expect(validateVisitInput(visit({ issueAction: " ".repeat(40) }), TODAY)).toHaveProperty("issueAction");
  });

  it("accepts issue/action at exactly 20 characters", () => {
    expect(validateVisitInput(visit({ issueAction: "a".repeat(20) }), TODAY)).toEqual({});
  });

  it("accepts Devanagari text at the boundary", () => {
    expect(validateVisitInput(visit({ issueAction: "नाली".repeat(5) }), TODAY)).toEqual({});
  });

  it("rejects an anchal outside 1 to 6", () => {
    for (const officeId of [0, 7, -1, 2.5]) {
      expect(validateVisitInput(visit({ officeId }), TODAY)).toHaveProperty("officeId");
    }
    expect(validateVisitInput(visit({ officeId: 1 }), TODAY)).toEqual({});
    expect(validateVisitInput(visit({ officeId: 6 }), TODAY)).toEqual({});
  });

  it("rejects a ward outside 1 to 53", () => {
    for (const ward of [0, 54, -2, 12.5]) {
      expect(validateVisitInput(visit({ ward }), TODAY)).toHaveProperty("ward");
    }
    expect(validateVisitInput(visit({ ward: 1 }), TODAY)).toEqual({});
    expect(validateVisitInput(visit({ ward: 53 }), TODAY)).toEqual({});
  });

  it("rejects a service id outside 1 to 25", () => {
    for (const serviceId of [0, 26, 3.5]) {
      expect(validateVisitInput(visit({ serviceId }), TODAY)).toHaveProperty("serviceId");
    }
    expect(validateVisitInput(visit({ serviceId: 25 }), TODAY)).toEqual({});
  });

  it("rejects coordinates outside the possible range", () => {
    expect(validateVisitInput(visit({ gps: reading({ latitude: 91 }) }), TODAY)).toHaveProperty("gps");
    expect(validateVisitInput(visit({ gps: reading({ longitude: -181 }) }), TODAY)).toHaveProperty("gps");
    expect(validateVisitInput(visit({ gps: reading({ latitude: Number.NaN }) }), TODAY)).toHaveProperty("gps");
  });

  it("reports every broken field at once", () => {
    const errors = validateVisitInput(
      visit({ ward: 99, serviceId: 0, issueAction: "no" }),
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(["issueAction", "serviceId", "ward"]);
  });
});
