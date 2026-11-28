import { useContext, useState } from "react";
import { Language, useText } from "../../i18n";
import type { PeriodValue } from "../../../domain/period";
import { formatCount, visitCard } from "../../../domain/visit-cards";
import services from "../../../shared/services.json";
import { getVisitSummary } from "../../dashboard-data";
import PeriodPicker from "./PeriodPicker";
import { AnchalFilter } from "./Filters";
import SectionCard from "./SectionCard";
import { useSection } from "./useSection";
import { leadingBody, leadingHelp } from "../../ui";

export default function FieldVisitsSection() {
  const t = useText();
  const lang = useContext(Language);
  const [period, setPeriod] = useState<PeriodValue>({ kind: "today", from: "", to: "" });
  const [officeId, setOfficeId] = useState<number | undefined>(undefined);
  const { data, error } = useSection("visits", period, { officeId }, getVisitSummary);
  const nameOf = (id: number) => {
    const s = services.find((x) => x.id === id);
    return s ? (lang === "hi" ? s.name : s.en) : String(id);
  };

  return (
    <SectionCard
      id="visits"
      title={t("Field visits", "क्षेत्रीय निरीक्षण")}
      filters={
        <>
          <PeriodPicker name="visits" value={period} onChange={setPeriod} />
          <AnchalFilter id="visits-anchal" value={officeId} onChange={setOfficeId} />
        </>
      }
      error={error}
    >
      {data && data.visits === 0 && (
        <p data-no-visits className={`${leadingBody} text-muted-foreground`}>
          {t("No visits in this period.", "इस अवधि में कोई निरीक्षण नहीं।")}
        </p>
      )}
      {data && data.visits > 0 && (
        <>
          <p data-visit-count className={`${leadingBody} text-muted-foreground`}>
            {t(
              `${data.visits} ${data.visits === 1 ? "visit" : "visits"} by ${data.officers} ${data.officers === 1 ? "officer" : "officers"}. Each service counts its own thing, so there is no single total.`,
              `${data.officers} अधिकारियों द्वारा ${data.visits} निरीक्षण। हर सेवा अपनी ही चीज़ गिनती है, इसलिए कोई एक योग नहीं है।`,
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.services.map((summary) => {
              const card = visitCard(summary);
              return (
                <article
                  key={card.serviceId}
                  data-visit-card={card.serviceId}
                  className="grid min-w-0 content-start gap-1.5 rounded-lg border border-border bg-card p-4"
                >
                  <h3 className={`text-[13.5px] font-semibold ${leadingBody} text-foreground`}>{nameOf(card.serviceId)}</h3>
                  <p className={`text-[12.5px] ${leadingHelp} text-muted-foreground`}>
                    {t(`${card.visits} ${card.visits === 1 ? "visit" : "visits"}`, `${card.visits} निरीक्षण`)}
                  </p>
                  <p className={`${leadingBody} text-foreground`}>
                    <span className="font-mono text-[22px] font-semibold tabular-nums">{formatCount(card.headline.value)}</span>{" "}
                    <span className="text-[13px] text-muted-foreground">{t(card.headline.en, card.headline.hi)}</span>
                  </p>
                  <p className={`text-[13px] ${leadingHelp} text-muted-foreground`}>{t(card.sub.en, card.sub.hi)}</p>
                  {card.missing > 0 && (
                    <p className={`text-[13px] ${leadingHelp} text-warning`}>
                      {t(`${card.missing} without a figure`, `${card.missing} में आंकड़ा नहीं`)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </SectionCard>
  );
}
