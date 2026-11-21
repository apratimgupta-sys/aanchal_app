import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string, pattern = "dd/MM/yyyy HH:mm") {
  const date = new Date(value);
  // formatInTimeZone throws on an invalid date, which would take the whole
  // page down mid-render. "—" is the portal's existing "no value" mark.
  if (Number.isNaN(date.getTime())) return "—";
  return formatInTimeZone(date, INDIA_TIME_ZONE, pattern);
}

export function formatServiceDate(value: string) {
  const date = parseISO(value);
  // format throws RangeError on an invalid date; "—" is the "no value" mark.
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy");
}

// Today's calendar date in India, which is what "today" means for a visit —
// the server applies the same rule when it rejects a non-today visit date.
export function indiaToday(now: Date = new Date()): string {
  return formatInTimeZone(now, INDIA_TIME_ZONE, "yyyy-MM-dd");
}
