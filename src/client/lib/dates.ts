import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string, pattern = "dd/MM/yyyy HH:mm") {
  return formatInTimeZone(new Date(value), INDIA_TIME_ZONE, pattern);
}

export function formatServiceDate(value: string) {
  return format(parseISO(value), "dd/MM/yyyy");
}
