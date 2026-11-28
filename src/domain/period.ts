// The periods a dashboard section can be set to, and the dates each one means.
// Dates are Indian calendar days as "YYYY-MM-DD" strings; the arithmetic is done
// in UTC on the date alone, so no clock or time zone can shift a day.
export type PeriodKind = "today" | "week" | "month" | "custom";

export type PeriodValue = { kind: PeriodKind; from: string; to: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// How many days a range covers, both ends included.
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

// The dates a period means today, or null when a custom range cannot be asked
// for: a date missing or malformed, the start after the end, or the end after
// today. "week" is today and the six days before it; "month" is the 1st to today.
export function periodRange(value: PeriodValue, today: string): { from: string; to: string } | null {
  switch (value.kind) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "custom":
      if (!DATE.test(value.from) || !DATE.test(value.to)) return null;
      if (value.from > value.to || value.to > today) return null;
      return { from: value.from, to: value.to };
  }
}
