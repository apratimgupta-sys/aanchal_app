import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string, pattern = "dd/MM/yyyy HH:mm") {
  return formatInTimeZone(new Date(value), INDIA_TIME_ZONE, pattern);
}

export function formatServiceDate(value: string) {
  return format(parseISO(value), "dd/MM/yyyy");
}

// Today's calendar date in India, which is what "today" means for a visit —
// the server applies the same rule when it rejects a non-today visit date.
export function indiaToday(now: Date = new Date()): string {
  return formatInTimeZone(now, INDIA_TIME_ZONE, "yyyy-MM-dd");
}
