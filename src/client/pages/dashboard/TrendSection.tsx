import { useState } from "react";
import { useText } from "../../i18n";
import { movesPendingBalance } from "../../../domain/service-kind";
import { DAILY_SERVICES } from "../../../domain/daily-entry-order";
import { formatCount } from "../../../domain/visit-cards";
import type { PeriodValue } from "../../../domain/period";
import { getDayRows } from "../../dashboard-data";
import PeriodPicker, { CHART_PERIODS } from "./PeriodPicker";
import { AnchalFilter, ServiceFilter } from "./Filters";
import SectionCard from "./SectionCard";
import DayChart from "./charts/DayChart";
import { useSection } from "./useSection";

const QUEUED = DAILY_SERVICES.filter((s) => movesPendingBalance(s.id));

export default function TrendSection() {
  const t = useText();
  const [period, setPeriod] = useState<PeriodValue>({ kind: "month", from: "", to: "" });
  const [officeId, setOfficeId] = useState<number | undefined>(undefined);
  const [serviceId, setServiceId] = useState<number | undefined>(undefined);
  const { data, range, error } = useSection("trend", period, { officeId, serviceId }, getDayRows);
  const rows = data?.rows ?? [];

  return (
    <SectionCard
      id="trend"
      title={t("Received and disposed", "प्राप्त और निस्तारित")}
      subtitle={t("Applications per day", "प्रतिदिन आवेदन")}
      filters={
        <>
          <PeriodPicker name="trend" value={period} onChange={setPeriod} kinds={CHART_PERIODS} />
          <ServiceFilter
            id="trend-service"
            value={serviceId}
            onChange={setServiceId}
            services={QUEUED}
            allLabel={t(`All ${QUEUED.length} with applications`, `आवेदन वाली सभी ${QUEUED.length} सेवाएँ`)}
          />
          <AnchalFilter id="trend-anchal" value={officeId} onChange={setOfficeId} />
        </>
      }
      error={error}
    >
      {data && range && (
        <DayChart
          kind="lines"
          series={[
            { label: t("Received", "प्राप्त"), colour: 1 },
            { label: t("Disposed", "निस्तारित"), colour: 2 },
          ]}
          days={rows.map((r) => ({ date: r.date, values: [r.received, r.completed] }))}
          format={formatCount}
          title={t(
            `Received and disposed per day, ${range.from} to ${range.to}`,
            `प्रतिदिन प्राप्त और निस्तारित, ${range.from} से ${range.to}`,
          )}
        />
      )}
    </SectionCard>
  );
}
