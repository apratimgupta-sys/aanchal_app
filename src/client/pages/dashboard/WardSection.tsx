import { useState } from "react";
import { useText } from "../../i18n";
import type { PeriodValue } from "../../../domain/period";
import { WARD_MAX, WARD_MIN } from "../../../domain/visit";
import { getVisitSummary } from "../../dashboard-data";
import PeriodPicker from "./PeriodPicker";
import SectionCard from "./SectionCard";
import { useSection } from "./useSection";

const SHADE = [
  "border border-border bg-card text-muted-foreground",
  "bg-ward-1 text-foreground",
  "bg-ward-2 text-foreground",
  "bg-ward-3 text-primary-foreground",
] as const;
const shade = (visits: number) => SHADE[Math.min(visits, 3)];

export default function WardSection() {
  const t = useText();
  const [period, setPeriod] = useState<PeriodValue>({ kind: "today", from: "", to: "" });
  const { data, error } = useSection("wards", period, {}, getVisitSummary);

  const numbers = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => WARD_MIN + i);
  const counts = new Map((data?.wards ?? []).map((w) => [w.ward, w.visits]));
  const none = numbers.filter((n) => !counts.get(n)).length;

  const legend: [string, string][] = [
    [t("None", "कोई नहीं"), SHADE[0]],
    ["1", SHADE[1]],
    ["2", SHADE[2]],
    [t("3 or more", "3 या अधिक"), SHADE[3]],
  ];

  return (
    <SectionCard
      id="wards"
      title={t("Where the visits were", "निरीक्षण कहाँ हुए")}
      subtitle={
        data
          ? t(
              `All ${WARD_MAX} wards. ${none} had no visit in this period.`,
              `सभी ${WARD_MAX} वार्ड। इस अवधि में ${none} वार्डों में कोई निरीक्षण नहीं हुआ।`,
            )
          : undefined
      }
      aside={
        <ul data-ward-legend className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {legend.map(([label, classes]) => (
            <li key={label} className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className={`inline-block size-4 rounded-sm ${classes}`} />
              {label}
            </li>
          ))}
        </ul>
      }
      filters={<PeriodPicker name="wards" value={period} onChange={setPeriod} />}
      error={error}
    >
      {data && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
          {numbers.map((n) => {
            const visits = counts.get(n) ?? 0;
            return (
              <li
                key={n}
                data-ward={n}
                aria-label={t(
                  `Ward ${n}: ${visits === 0 ? "no visits" : visits === 1 ? "1 visit" : `${visits} visits`}`,
                  `वार्ड ${n}: ${visits === 0 ? "कोई निरीक्षण नहीं" : `${visits} निरीक्षण`}`,
                )}
                className={`grid h-11 place-items-center rounded-md font-mono text-[13px] tabular-nums ${shade(visits)}`}
              >
                {n}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
