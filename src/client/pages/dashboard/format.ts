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
