import { collects } from "./service-kind";

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
  // Each rule applies only where the shape collects both of its operands.
  // So: disposals against receipts is counter work only — work on the ground
  // is not a queue (a crew can cut grass with no request behind it) and a
  // payment completes nothing — and the three rules on retired fields never
  // apply, because no shape asks for either side of them.
  if (collects(serviceId, "completed", "received") && value.completed > value.received)
    errors.completed = "Completed cannot exceed received";
  if (collects(serviceId, "slaWithinTime", "completed") && value.slaWithinTime > value.completed)
    errors.slaWithinTime = "Within-SLA completions cannot exceed completed";
  if (
    collects(serviceId, "complaintsResolved", "complaintsReceived") &&
    value.complaintsResolved > value.complaintsReceived
  )
    errors.complaintsResolved = "Resolved complaints cannot exceed received";
  if (
    collects(serviceId, "fieldCompleted", "fieldReceived") &&
    value.fieldCompleted > value.fieldReceived
  )
    errors.fieldCompleted = "Completed field tasks cannot exceed received";
  return errors;
}
