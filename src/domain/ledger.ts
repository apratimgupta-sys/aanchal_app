import { collects, collectsWorkDone, movesPendingBalance } from "./service-kind";
import { isCanonicalWard, WARD_MESSAGE } from "./entry-rules";
import type {
  Activity,
  Balances,
  EntryInput,
  EntryView,
  StoredEntry,
  Setup,
  PeriodFilter,
  MonitoringRow,
  ApiError,
} from "../shared/types";
export const dateIST = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const todayIST = () => dateIST(new Date());
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function parseMoney(s: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Enter rupees with at most two decimal places");
  const [a, b = ""] = s.split(".");
  const v = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(v)) throw new Error("Amount too large");
  return v;
}
export function validateEntry(e: EntryInput, today: string): ApiError | null {
  const errors: Record<string, string> = {};
  for (const k of [
    "received",
    "completed",
    "slaWithinTime",
    "amountPaise",
    "complaintsReceived",
    "complaintsResolved",
    "fieldReceived",
    "fieldCompleted",
  ] as (keyof Activity)[])
    if (!Number.isSafeInteger(e[k]) || e[k] < 0 || e[k] > 1_000_000_000)
      errors[k] = "Enter a nonnegative whole number within the allowed limit";
  if (!validDate(e.serviceDate) || e.serviceDate > today)
    errors.serviceDate = "Enter a valid date through today";
  if (!Number.isInteger(e.serviceId) || e.serviceId < 1 || e.serviceId > 25)
    errors.serviceId = "Select a service";
  if (!isCanonicalWard(e.ward)) errors.ward = WARD_MESSAGE;
  if (typeof e.remarks !== "string" || e.remarks.length > 2000)
    errors.remarks = "Remarks must be at most 2000 characters";
  // Applies only where the shape collects both operands, as on the server. No
  // shape collects slaWithinTime, so a stored figure from a pre-cutover entry
  // can never refuse a correction to the figure the office can see.
  if (collects(e.serviceId, "slaWithinTime", "completed") && e.slaWithinTime > e.completed)
    errors.slaWithinTime = "Cannot exceed completed cases";
  if (
    e.avgDisposalDays !== null &&
    (!Number.isFinite(e.avgDisposalDays) ||
      e.avgDisposalDays < 0 ||
      e.avgDisposalDays > 100000)
  )
    errors.avgDisposalDays = "Enter valid nonnegative days";
  return Object.keys(errors).length
    ? {
        code: "VALIDATION",
        message: "Please correct the highlighted fields",
        fieldErrors: errors,
      }
    : null;
}
export function applyActivity(
  o: Balances,
  a: Activity & { serviceId: number },
): Balances {
  return {
    // Only a service that collects a queue (counter and counterRevenue) moves
    // the balance. Field work has none, and revenue services record payments in
    // `received` and complete nothing, so neither may move it.
    service: o.service + (movesPendingBalance(a.serviceId) ? a.received - a.completed : 0),
    complaints: o.complaints + a.complaintsReceived - a.complaintsResolved,
    field: o.field + a.fieldReceived - a.fieldCompleted,
  };
}
export function deriveEntryViews(
  initial: Balances,
  entries: StoredEntry[],
): EntryView[] {
  let balance = { ...initial };
  return [...entries]
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
    .map((e) => {
      const opening = { ...balance };
      balance = applyActivity(balance, e);
      if (Object.values(balance).some((v) => v < 0 || !Number.isSafeInteger(v)))
        throw new Error(
          `Invalid pending balance on ${e.serviceDate} (service ${e.serviceId})`,
        );
      return { ...e, opening, closing: { ...balance } };
    });
}
export function summarizePeriod(
  setups: Setup[],
  entries: StoredEntry[],
  filter: PeriodFilter,
  today: string,
): MonitoringRow[] {
  return Array.from({ length: 6 }, (_, i) => i + 1)
    .filter((id) => !filter.officeId || id === filter.officeId)
    .map((officeId) => {
      const setup = setups.find((s) => s.officeId === officeId);
      const r: MonitoringRow = {
        officeId,
        received: 0,
        completed: 0,
        slaWithinTime: 0,
        pending: 0,
        disposalPct: null,
        slaPct: null,
        amountPaise: 0,
        workDone: 0,
        complaintsPending: 0,
        fieldPending: 0,
        submitted: 0,
        expected: 0,
        configured: !!setup,
        reviewReasons: [],
      };
      if (!setup) {
        r.reviewReasons = ["Initial balances not configured"];
        return r;
      }
      const start =
        filter.from > setup.startDate ? filter.from : setup.startDate;
      const end = filter.to < today ? filter.to : today;
      r.expected =
        start <= end
          ? (Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1) *
            (filter.serviceId ? 1 : 25)
          : 0;
      for (const b of setup.balances.filter(
        (b) => !filter.serviceId || b.serviceId === filter.serviceId,
      )) {
        const all = entries.filter(
          (e) =>
            e.officeId === officeId &&
            e.serviceId === b.serviceId &&
            e.serviceDate <= filter.to,
        );
        const views = deriveEntryViews(b.opening, all);
        const close =
          filter.to < setup.startDate
            ? { service: 0, complaints: 0, field: 0 }
            : (views.at(-1)?.closing ?? b.opening);
        // Only a service with a queue has a pending balance to report. The
        // service balance of the 11 revenue and field-work services is frozen,
        // so counting it would report a pending figure nothing can ever work
        // off.
        if (movesPendingBalance(b.serviceId)) r.pending += close.service;
        r.complaintsPending += close.complaints;
        r.fieldPending += close.field;
        for (const e of all.filter((e) => e.serviceDate >= filter.from)) {
          // Queue work only (counter and counterRevenue), exactly as the server
          // sums them: a payment completes no case, and field work completes
          // against a received of 0, so counting either in pushes Disposal %
          // past 100. Field work is reported separately as workDone; money
          // comes from every service that collects it.
          if (movesPendingBalance(b.serviceId)) {
            r.received += e.received;
            r.completed += e.completed;
            r.slaWithinTime += e.slaWithinTime;
          }
          r.amountPaise += e.amountPaise;
          if (collectsWorkDone(b.serviceId)) r.workDone += e.completed;
          r.submitted++;
        }
      }
      r.disposalPct = r.received ? (r.completed / r.received) * 100 : null;
      r.slaPct = r.completed ? (r.slaWithinTime / r.completed) * 100 : null;
      // Mirror of the server's review reasons. The three thresholds over SLA,
      // complaints and field tasks are gone with the fields that fed them.
      // These two literals are a cross-repo contract: they are translated by
      // exact key match in i18n.tsx, so rewording one silently drops Hindi.
      if (r.pending > 10) r.reviewReasons.push("Pending > 10");
      if (r.disposalPct !== null && r.disposalPct < 90)
        r.reviewReasons.push("Disposal < 90%");
      return r;
    });
}
