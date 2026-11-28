import { useContext, useState } from "react";
import { Language, useText } from "../../i18n";
import { collects } from "../../../domain/service-kind";
import { DAILY_SERVICES } from "../../../domain/daily-entry-order";
import type { PeriodValue } from "../../../domain/period";
import { getDayRows } from "../../dashboard-data";
import PeriodPicker, { CHART_PERIODS } from "./PeriodPicker";
import { AnchalFilter, ServiceFilter } from "./Filters";
import SectionCard from "./SectionCard";
import DayChart from "./charts/DayChart";
import { useSection } from "./useSection";
import { compactRupees, currency } from "./format";
import { leadingHeading, leadingHelp } from "../../ui";

const COLLECTING = DAILY_SERVICES.filter((s) => collects(s.id, "amountPaise"));

export default function CollectionSection() {
  const t = useText();
  const lang = useContext(Language);
  const [period, setPeriod] = useState<PeriodValue>({ kind: "month", from: "", to: "" });
  const [officeId, setOfficeId] = useState<number | undefined>(undefined);
  const [serviceId, setServiceId] = useState<number | undefined>(undefined);
  const { data, range, error } = useSection("collection", period, { officeId, serviceId }, getDayRows);
  const rows = data?.rows ?? [];
  const total = rows.reduce((a, r) => a + r.amountPaise, 0);

  return (
    <SectionCard
      id="collection"
      range={range}
      title={t("Collection", "संग्रह")}
      subtitle={t(
        "Amount collected per day: fees on applications and the collections together.",
        "प्रतिदिन संग्रहित राशि: आवेदनों के शुल्क और संग्रह, दोनों।",
      )}
      filters={
        <>
          <PeriodPicker name="collection" value={period} onChange={setPeriod} kinds={CHART_PERIODS} />
          <AnchalFilter id="collection-anchal" value={officeId} onChange={setOfficeId} />
          <ServiceFilter
            id="collection-service"
            value={serviceId}
            onChange={setServiceId}
            services={COLLECTING}
            allLabel={t(`All ${COLLECTING.length} that collect`, `राशि लेने वाली सभी ${COLLECTING.length} सेवाएँ`)}
          />
        </>
      }
      aside={
        data && (
          <div data-collection-total className="grid gap-0.5 sm:text-right">
            <span className={`text-xs ${leadingHelp} text-muted-foreground`}>
              {t("Collected in this period", "इस अवधि में संग्रहित")}
            </span>
            <span className={`font-mono text-lg font-semibold ${leadingHeading} tabular-nums`}>{currency(total)}</span>
          </div>
        )
      }
      error={error}
    >
      {data && range && (
        <DayChart
          kind="bars"
          series={[{ label: t("Collected", "संग्रहित"), colour: 1 }]}
          days={rows.map((r) => ({ date: r.date, values: [r.amountPaise] }))}
          format={currency}
          formatAxis={(p) => compactRupees(p, lang)}
          title={t(
            `Collection per day, ${range.from} to ${range.to}`,
            `प्रतिदिन संग्रह, ${range.from} से ${range.to}`,
          )}
        />
      )}
    </SectionCard>
  );
}
