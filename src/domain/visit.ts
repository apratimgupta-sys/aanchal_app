import type {
  FieldVisitInput,
  GpsReading,
  VerificationResult,
} from "../shared/types";

// A reading is treated as on-site evidence only when it is precise enough and
// reached the server soon enough after it was taken. Both thresholds are
// starting points, to be revisited once there is a month of real readings.
export const VERIFY_ACCURACY_METRES = 100;
export const VERIFY_WINDOW_MINUTES = 30;

export const ANCHAL_MIN = 1;
export const ANCHAL_MAX = 6;
export const WARD_MIN = 1;
export const WARD_MAX = 53;
export const SERVICE_MIN = 1;
export const SERVICE_MAX = 25;
export const ISSUE_ACTION_MIN_LENGTH = 20;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isWholeNumberWithin(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function verifyOnSite(
  reading: GpsReading,
  receivedAt: string,
): VerificationResult {
  const { accuracyMetres, capturedAt } = reading;
  if (
    !Number.isFinite(accuracyMetres) ||
    accuracyMetres < 0 ||
    accuracyMetres > VERIFY_ACCURACY_METRES
  )
    return { verified: false, reason: "accuracy" };

  const captured = Date.parse(capturedAt);
  const received = Date.parse(receivedAt);
  if (!Number.isFinite(captured) || !Number.isFinite(received))
    return { verified: false, reason: "stale" };

  // Absolute difference: a device clock ahead of the server is as suspect as
  // one behind it, and neither should be read as a fresh fix.
  const gapMinutes = Math.abs(received - captured) / 60_000;
  if (gapMinutes > VERIFY_WINDOW_MINUTES)
    return { verified: false, reason: "stale" };

  return { verified: true, reason: "ok" };
}

export function validateVisitInput(
  input: FieldVisitInput,
  today: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!DATE_PATTERN.test(input.visitDate)) errors.visitDate = "Enter a valid date";
  else if (input.visitDate !== today)
    errors.visitDate = "A visit can only be recorded on the day it was made";

  if (!TIME_PATTERN.test(input.visitTime)) errors.visitTime = "Enter a valid time";

  if (!isWholeNumberWithin(input.officeId, ANCHAL_MIN, ANCHAL_MAX))
    errors.officeId = "Select an Anchal";

  if (!isWholeNumberWithin(input.ward, WARD_MIN, WARD_MAX))
    errors.ward = `Select a ward from ${WARD_MIN} to ${WARD_MAX}`;

  if (!isWholeNumberWithin(input.serviceId, SERVICE_MIN, SERVICE_MAX))
    errors.serviceId = "Select an activity";

  if (input.issueAction.trim().length < ISSUE_ACTION_MIN_LENGTH)
    errors.issueAction = `Describe what was seen and what is to be done (at least ${ISSUE_ACTION_MIN_LENGTH} characters)`;

  const { latitude, longitude } = input.gps;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    errors.gps = "Capture the location at the site";

  return errors;
}
