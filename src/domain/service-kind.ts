import services from "../shared/services.json" with { type: "json" };

// What a service is actually counting, taken from the Service Master's
// Primary Monitoring Unit column rather than a hand-kept list of ids.
//
//   counter   — cases that arrive, queue and get disposed
//   counterRevenue — cases that arrive, queue and get disposed AND money taken
//               on them (an application with a fee): a queue and money together
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
export type ServiceKind = "counter" | "counterRevenue" | "revenue" | "fieldwork" | "grievance";

const KIND_BY_UNIT: Record<string, ServiceKind> = {
  Applications: "counter",
  "Applications / Licences": "counter",
  "Applications / Connections": "counter",
  Cases: "counter",
  Registrations: "counter",
  "Beneficiaries / Applications": "counter",
  "Beneficiaries / Licences": "counter",
  Bookings: "counter",
  "Applications / ₹": "counterRevenue",
  "Cases / ₹": "counterRevenue",
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

// The four shapes the daily entry form takes. Grievance handling is a queue
// of cases like any other, so it takes the counter shape. counterRevenue is
// the one shape where a queue and money coexist (services 1, 3, 4, 7).
//
// TWIN: MonitoringRules.FormShape in the backend repo
// (src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs), which
// hardcodes the same four sets because the backend has no service master.
// This side derives them from services.json's `unit` column, so the two agree
// only by hand. An edit to either must be made in both, in the same change: a
// service that validates and derives under one shape and renders under another
// re-derives its whole closing history on the next read. Changing a `unit`
// string is an edit to both. The order of the collected fields is part of the
// twin: tests/domain/shape-twin.fixture.json holds the golden table, and the
// backend repo carries the identical file.
export type FormShape = "counter" | "counterRevenue" | "revenue" | "fieldwork";

export function formShape(serviceId: number): FormShape {
  const kind = serviceKind(serviceId);
  return kind === "grievance" ? "counter" : kind;
}

// Only the shapes with a queue move the pending balance: counter, and
// counterRevenue, whose services were counter services with opening balances
// already locked in.
export function movesPendingBalance(serviceId: number): boolean {
  const shape = formShape(serviceId);
  return shape === "counter" || shape === "counterRevenue";
}

// Whether the daily entry collects this service at all. The eight field-work
// services are reported by field officers as visits, so a clerk is not asked for
// them; everything else is. Derived from the shape, never from a list of ids.
// Mirrors MonitoringRules.DailyEntryCollects on the server:
// `!IsFieldWork(id)`. The shape stays and the services stay in the master:
// visits reference them by id and entries already filed against them must stay
// readable, so this narrows what the entry form offers and nothing else.
export function dailyEntryCollects(serviceId: number): boolean {
  return formShape(serviceId) !== "fieldwork";
}

// Work done: a completed count with no queue beside it. Asked by what the
// service collects, not by what shape it is called, so a future shape that
// collects `completed` alone is summed and shown without anyone remembering to
// add it here. Today that is the eight field-work services. The server's
// MonitoringService computes workDone from this same rule — `Collects(id,
// "completed") && !Collects(id, "received")` — so both repos derive it one way.
// MonitoringRules.IsFieldWork survives there as a shape helper with no
// production caller, used only to classify services in one test.
export function collectsWorkDone(serviceId: number): boolean {
  return collects(serviceId, "completed") && !collects(serviceId, "received");
}

// What the daily form actually asks a service for, by shape: two numbers
// instead of nine. Everything else in the record is retired — kept for the
// entries already filed with it, collected from nobody.
// Mirrors MonitoringRules.CollectedFields on the server.
const COLLECTED: Record<FormShape, readonly string[]> = {
  counter: ["received", "completed"],
  counterRevenue: ["received", "completed", "amountPaise"],
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
