import services from "../shared/services.json";
type Snapshot = Record<string, unknown>;
export const auditFields: Record<string, [string, string]> = {
  serviceDate: ["Service date", "सेवा तिथि"],
  reportingDate: ["Registration date", "पंजीकरण तिथि"],
  startDate: ["Reporting start date", "रिपोर्टिंग आरंभ तिथि"],
  ward: ["Ward", "वार्ड"],
  received: ["Received / Transactions", "प्राप्त / लेन-देन"],
  completed: ["Completed / Disposed", "पूर्ण / निस्तारित"],
  slaWithinTime: ["Completed within SLA", "समय सीमा में पूर्ण"],
  amountPaise: ["Amount collected", "संग्रहित राशि"],
  complaintsReceived: ["Complaints received", "प्राप्त शिकायतें"],
  complaintsResolved: ["Complaints resolved", "निस्तारित शिकायतें"],
  fieldReceived: ["Field work received", "प्राप्त क्षेत्र कार्य"],
  fieldCompleted: ["Field work completed", "पूर्ण क्षेत्र कार्य"],
  avgDisposalDays: ["Average disposal days", "औसत निस्तारण दिवस"],
  remarks: ["Remarks", "टिप्पणी"],
  "opening.service": ["Opening pending services", "आरंभिक लंबित सेवाएँ"],
  "opening.complaints": ["Opening pending complaints", "आरंभिक लंबित शिकायतें"],
  "opening.field": ["Opening pending field work", "आरंभिक लंबित क्षेत्र कार्य"],
};
function parse(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Snapshot)
      : null;
  } catch {
    return null;
  }
}
export function serviceName(id: unknown, lang: string) {
  const service = services.find((s) => s.id === id);
  return service
    ? lang === "hi"
      ? service.name
      : service.en
    : `${lang === "hi" ? "सेवा" : "Service"} ${id}`;
}
export function auditComparison(beforeRaw: string | null, afterRaw: string) {
  const before = parse(beforeRaw),
    after = parse(afterRaw);
  const changes: {
    key: string;
    before: unknown;
    after: unknown;
    serviceId?: number;
  }[] = [];
  if (!after || (beforeRaw && !before)) return { valid: false, after, changes };
  const add = (
    key: string,
    old: unknown,
    value: unknown,
    serviceId?: number,
  ) => {
    if (value !== undefined && (!before || old !== value))
      changes.push({
        key,
        before: old,
        after: value,
        ...(serviceId === undefined ? {} : { serviceId }),
      });
  };
  for (const key of Object.keys(auditFields).filter((k) => !k.includes(".")))
    add(key, before?.[key], after[key]);
  // Setup snapshots contain balances; entry snapshots contain derived balances that
  // were not saved in older before snapshots and must not be reported as edits.
  if (Array.isArray(after.balances)) {
    for (const item of after.balances as {
      serviceId: number;
      opening: Record<string, unknown>;
    }[]) {
      const previous = Array.isArray(before?.balances)
        ? (before.balances as (typeof item)[]).find(
            (b) => b.serviceId === item.serviceId,
          )
        : undefined;
      for (const kind of ["service", "complaints", "field"])
        add(
          `opening.${kind}`,
          previous?.opening?.[kind],
          item.opening?.[kind],
          item.serviceId,
        );
    }
  }
  return { valid: true, after, changes };
}
export function auditValue(key: string, value: unknown, lang: string) {
  if (value === undefined || value === null || value === "") return "—";
  if (key === "amountPaise" && typeof value === "number")
    return new Intl.NumberFormat(lang === "hi" ? "hi-IN" : "en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value / 100);
  if (
    key.endsWith("Date") &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  )
    return new Date(`${value}T00:00:00+05:30`).toLocaleDateString(
      lang === "hi" ? "hi-IN" : "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      },
    );
  return String(value);
}
