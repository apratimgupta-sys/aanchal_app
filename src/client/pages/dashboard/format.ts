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
