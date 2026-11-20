import { isFieldWork } from "./service-kind";

export type EntryCounts = {
  received: number;
  completed: number;
  slaWithinTime: number;
  complaintsReceived: number;
  complaintsResolved: number;
  fieldReceived: number;
  fieldCompleted: number;
};

// Cross-field rules, keyed by the field that should show the message. Mirrors
// MonitoringRules.ValidateEntry on the server, which is authoritative.
export function entryCrossFieldErrors(
  serviceId: number,
  value: EntryCounts,
): Record<string, string> {
  const errors: Record<string, string> = {};
  // Work on the ground is not a queue: a crew can cut grass or fog a route
  // with no request behind it, so completed may exceed received.
  if (!isFieldWork(serviceId) && value.completed > value.received)
    errors.completed = "Completed cannot exceed received";
  if (value.slaWithinTime > value.completed)
    errors.slaWithinTime = "Within-SLA completions cannot exceed completed";
  if (value.complaintsResolved > value.complaintsReceived)
    errors.complaintsResolved = "Resolved complaints cannot exceed received";
  if (value.fieldCompleted > value.fieldReceived)
    errors.fieldCompleted = "Completed field tasks cannot exceed received";
  return errors;
}

// There is no case to dispose of in field work, so no average to report.
export function avgDisposalDaysRequired(serviceId: number, completed: number): boolean {
  return !isFieldWork(serviceId) && completed > 0;
}
