export type Balances = { service: number; complaints: number; field: number };
export type Activity = {
  received: number;
  completed: number;
  slaWithinTime: number;
  amountPaise: number;
  complaintsReceived: number;
  complaintsResolved: number;
  fieldReceived: number;
  fieldCompleted: number;
};
export type EntryInput = Activity & {
  serviceId: number;
  serviceDate: string;
  ward: string;
  avgDisposalDays: number | null;
  remarks: string;
  // The office's deliberate "nothing happened on this service today". Not inferred from zeros.
  nothingToReport: boolean;
};
export type StoredEntry = EntryInput & {
  reportingDate: string;
  id: string;
  officeId: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type EntryView = StoredEntry & { opening: Balances; closing: Balances };
export type Setup = {
  officeId: number;
  startDate: string;
  version: number;
  balances: { serviceId: number; opening: Balances }[];
};
export type UserSession = {
  userId: string;
  username: string;
  role: "office" | "commissioner" | "officer" | "rolemanager";
  officeId: number | null;
  expiresAt: number;
  officer?: OfficerProfile;
  mustChangePassword?: boolean;
};
export type OfficerProfile = {
  id: string;
  username: string;
  name: string;
  designation: string;
  homeOfficeId: number;
  active: boolean;
  // The stored role string, sent by the user-administration roster so it can tell
  // a field officer from an Anchal office login. Absent on a field officer's own session.
  role?: string;
};
export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  capturedAt: string;
};
export type FieldVisitInput = {
  visitDate: string;
  visitTime: string;
  officeId: number;
  ward: number;
  serviceId: number;
  gps: GpsReading;
  issueAction: string;
};
export type StoredFieldVisit = FieldVisitInput & {
  id: string;
  officerId: string;
  officerName: string;
  officerDesignation: string;
  receivedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};
export type FieldVisitView = Omit<StoredFieldVisit, "gps"> & { gps: GpsReading | null };
export type SaveCommand = {
  requestId: string;
  expectedVersion: number | null;
  mode: "today" | "backdate";
  input: EntryInput;
  reason: string | null;
};
export type SetupCommand = {
  requestId: string;
  expectedVersion: number | null;
  startDate: string;
  balances: Setup["balances"];
  reason: string | null;
};
export type PeriodFilter = {
  from: string;
  to: string;
  officeId?: number;
  serviceId?: number;
};
export type MonitoringRow = {
  officeId: number;
  received: number;
  completed: number;
  slaWithinTime: number;
  pending: number;
  disposalPct: number | null;
  slaPct: number | null;
  amountPaise: number;
  // Sum of `completed` over the eight field-work services in the filtered
  // range: a flow, not a closing balance. Replaces the field-tasks-pending
  // tile, whose balance no longer moves.
  workDone: number;
  // The wire still carries these; nothing renders them since the form stopped
  // collecting complaint, field and SLA figures.
  complaintsPending: number;
  fieldPending: number;
  submitted: number;
  expected: number;
  configured: boolean;
  reviewReasons: string[];
};
export type Audit = {
  id: string;
  officeId: number;
  actor: string;
  at: string;
  action: string;
  reason: string | null;
  before: string | null;
  after: string;
};
export type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  conflictDate?: string;
  serviceId?: number;
};
export type RevisionEvent = {
  type: "invalidate";
  officeId: number;
  revision: number;
};
