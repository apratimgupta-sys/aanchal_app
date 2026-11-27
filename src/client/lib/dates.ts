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

// The wall-clock time in India as HH:mm. The date above and this time come out of the
// same zone, so a visit's pair cannot disagree because the handset is set elsewhere.
export function indiaTimeOfDay(now: Date): string {
  return formatInTimeZone(now, INDIA_TIME_ZONE, "HH:mm");
}

// The time a visit filed at `now` carries. The visit's date is the day it is filed
// (today only, by the client's rule), so its time has to be a time on that day that has
// already happened. The best evidence of when the officer was there is the moment the
// location was captured, so that is used when it falls on today and is not ahead of the
// clock. A capture from an earlier day (a form opened before midnight, filed after it)
// cannot be today's time: it is filed at `now`, and the capture itself is still stored,
// untouched, as GpsCapturedAt.
export function visitTimeAt(gpsCapturedAt: string, now: Date): string {
  const captured = new Date(gpsCapturedAt);
  const usable =
    gpsCapturedAt !== "" &&
    !Number.isNaN(captured.getTime()) &&
    captured.getTime() <= now.getTime() &&
    indiaToday(captured) === indiaToday(now);
  return indiaTimeOfDay(usable ? captured : now);
}
