export const currency = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

// A stamp we can print, or null. Never lets "Invalid Date" reach the screen.
export const usableStamp = (value?: string | null) =>
  value && !Number.isNaN(new Date(value).getTime()) ? value : null;

export const percent = (value: number | null) => (value === null ? "—" : value.toFixed(1) + "%");

export const compactRupees = (paise: number, lang: "en" | "hi") =>
  "₹" + new Intl.NumberFormat(lang === "hi" ? "hi-IN" : "en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(paise / 100);

// The dates a section shows: one date for a single day, otherwise both ends with an
// en dash. Day, month, year in both languages (the same Intl options as the audit
// view's dates); nothing when there is no range.
export const rangeLabel = (range: { from: string; to: string } | null, lang: "en" | "hi"): string => {
  if (!range) return "";
  const day = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const at = (date: string) => day.format(new Date(`${date}T00:00:00Z`));
  return range.from === range.to ? at(range.from) : `${at(range.from)} – ${at(range.to)}`;
};
