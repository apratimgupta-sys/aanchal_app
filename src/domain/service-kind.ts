import services from "../shared/services.json";

// What a service is actually counting, taken from the Service Master's
// Primary Monitoring Unit column rather than a hand-kept list of ids.
//
//   counter   — cases that arrive, queue and get disposed
//   revenue   — payments taken; nothing queues
//   fieldwork — work done on the ground, often with no request behind it
//   grievance — complaint handling, which this portal does not record
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
