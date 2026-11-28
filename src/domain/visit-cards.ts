import wording from "../shared/visit-card-wording.json" with { type: "json" };
import type { VisitServiceSummary } from "../shared/types";
import { fieldsFor } from "./field-visit-fields";

// What one field-work service's card on the Commissioner's dashboard says. The
// server sends each service's sums and splits; which of them is the headline,
// and what it is called, is wording, held in visit-card-wording.json.
export type VisitCard = {
  serviceId: number;
  visits: number;
  headline: { value: number; en: string; hi: string };
  sub: { en: string; hi: string };
  // Visits that gave no value for the headline number. Details are optional, so
  // the card says so rather than letting the sum quietly understate.
  missing: number;
};

type Headline = { number?: string; en: string; hi: string };
type Sub = { split: string } | { number: string; en: string; hi: string } | { wards: true };
type Wording = Record<string, { headline: Headline; sub: Sub }>;

const WORDING = wording as Wording;

// Whole numbers as they are, measurements to one decimal, Indian grouping.
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

export function visitCard(summary: VisitServiceSummary): VisitCard {
  const words = WORDING[String(summary.serviceId)];
  if (!words) throw new Error(`No card wording for service ${summary.serviceId}`);
  const numberKey = words.headline.number;
  const number = numberKey === undefined ? undefined : summary.numbers.find((n) => n.key === numberKey);
  const headline = {
    value: numberKey === undefined ? summary.visits : (number?.sum ?? 0),
    en: words.headline.en,
    hi: words.headline.hi,
  };
  const missing = numberKey === undefined ? 0 : summary.visits - (number?.visits ?? 0);
  return { serviceId: summary.serviceId, visits: summary.visits, headline, sub: subLine(summary, words.sub, numberKey), missing };
}

function subLine(summary: VisitServiceSummary, sub: Sub, headlineNumber: string | undefined): { en: string; hi: string } {
  if ("wards" in sub) {
    const n = summary.wardsCovered;
    return { en: `in ${n} ${n === 1 ? "ward" : "wards"}`, hi: `${n} वार्ड में` };
  }
  if ("number" in sub) {
    const value = formatCount(summary.numbers.find((n) => n.key === sub.number)?.sum ?? 0);
    return { en: `${value} ${sub.en}`, hi: `${value} ${sub.hi}` };
  }
  // A split: the headline number per choice where the service has one,
  // otherwise visits per choice, in the form's own option order.
  const field = fieldsFor(summary.serviceId).find((f) => f.key === sub.split);
  const choice = summary.choices.find((c) => c.key === sub.split);
  const parts = (field?.options ?? []).map((option) => {
    const got = choice?.options.find((o) => o.value === option.value);
    const value =
      headlineNumber === undefined ? (got?.visits ?? 0) : (got?.numbers.find((n) => n.key === headlineNumber)?.sum ?? 0);
    return { en: `${option.en} ${formatCount(value)}`, hi: `${option.hi} ${formatCount(value)}` };
  });
  return { en: parts.map((p) => p.en).join(" · "), hi: parts.map((p) => p.hi).join(" · ") };
}
