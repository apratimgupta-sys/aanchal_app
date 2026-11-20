import services from "../shared/services.json";

// What a service is actually counting, taken from the Service Master's
// Primary Monitoring Unit column rather than a hand-kept list of ids.
//
//   counter   — cases that arrive, queue and get disposed
//   revenue   — payments taken; nothing queues
//   fieldwork — work done on the ground, often with no request behind it
//   grievance — complaint handling, which service 12 does record: a complaint
//               arrives, waits and is disposed of, so it takes the counter
//               shape and moves the pending balance like any other queue
//
// The kind says what a service counts; it does not say what the form asks for.
// Nothing downstream may be keyed on `kind` — use formShape below, which maps
// grievance onto counter. Keying the shape predicates on kind is what would
// quietly stop service 12's balance from moving.
export type ServiceKind = "counter" | "revenue" | "fieldwork" | "grievance";

const KIND_BY_UNIT: Record<string, ServiceKind> = {
  Applications: "counter",
  "Applications / Licences": "counter",
  "Applications / Connections": "counter",
  Cases: "counter",
  Registrations: "counter",
  "Beneficiaries / Applications": "counter",
  "Beneficiaries / Licences": "counter",
  Bookings: "counter",
  "Transactions / ₹": "revenue",
  Complaints: "grievance",
  "Requests / Trips": "fieldwork",
  "Requests / Activities": "fieldwork",
  "Complaints / Repairs": "fieldwork",
  "Works / Complaints": "fieldwork",
  "Field Works": "fieldwork",
};

export const KNOWN_UNITS = Object.keys(KIND_BY_UNIT);

const KIND_BY_ID = new Map<number, ServiceKind>(
  services.map((s) => [s.id, KIND_BY_UNIT[s.unit] ?? "counter"]),
);

// An id or unit we do not recognise falls back to counter work, which keeps
// the stricter rules rather than quietly dropping them.
export function serviceKind(serviceId: number): ServiceKind {
  return KIND_BY_ID.get(serviceId) ?? "counter";
}

// The three shapes the daily entry form takes. Grievance handling is a queue
// of cases like any other, so it takes the counter shape.
//
// TWIN: MonitoringRules.FormShape in the backend repo
// (src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs), which
// hardcodes the same three sets because the backend has no service master.
// This side derives them from services.json's `unit` column, so the two agree
// only by hand. An edit to either must be made in both, in the same change: a
// service that validates and derives under one shape and renders under another
// re-derives its whole closing history on the next read. Changing a `unit`
// string is an edit to both.
export type FormShape = "counter" | "revenue" | "fieldwork";

export function formShape(serviceId: number): FormShape {
  const kind = serviceKind(serviceId);
  return kind === "grievance" ? "counter" : kind;
}

// Only the counter shape has a queue, so only it moves the pending balance.
export function movesPendingBalance(serviceId: number): boolean {
  return formShape(serviceId) === "counter";
}

export function isFieldWork(serviceId: number): boolean {
  return formShape(serviceId) === "fieldwork";
}

// What the daily form actually asks a service for, by shape: two numbers
// instead of nine. Everything else in the record is retired — kept for the
// entries already filed with it, collected from nobody.
// Mirrors MonitoringRules.CollectedFields on the server.
const COLLECTED: Record<FormShape, readonly string[]> = {
  counter: ["received", "completed"],
  revenue: ["received", "amountPaise"],
  fieldwork: ["completed"],
};

export function collectedFields(serviceId: number): readonly string[] {
  return COLLECTED[formShape(serviceId)];
}

// A cross-field rule can only be acted on if the office is asked for BOTH of
// its operands. Keyed to anything else, the message names a field the form
// does not render, so the office sees "Please correct the highlighted fields"
// with nothing highlighted and no way to save. The retired fields keep their
// stored values through a correction, so their consistency holds by
// construction.
export function collects(serviceId: number, ...fields: string[]): boolean {
  const collected = collectedFields(serviceId);
  return fields.every((f) => collected.includes(f));
}
