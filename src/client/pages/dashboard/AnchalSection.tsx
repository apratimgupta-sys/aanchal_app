import { useEffect, useState } from "react";
import { Table, Td, Th, cardTable, cardTableWrap, cardTitle, useScrollRegion } from "../../ui";
import { useText } from "../../i18n";
import { collects, movesPendingBalance } from "../../../domain/service-kind";
import { DAILY_SERVICES } from "../../../domain/daily-entry-order";
import type { PeriodValue } from "../../../domain/period";
import { getAnchalRows } from "../../dashboard-data";
import PeriodPicker from "./PeriodPicker";
import { ServiceFilter } from "./Filters";
import SectionCard from "./SectionCard";
import { useSection } from "./useSection";
import { currency, percent, usableStamp } from "./format";

export default function AnchalSection({ onStamp }: { onStamp?: (stamp: string) => void }) {
  const t = useText();
  const scrollRegion = useScrollRegion();
  const [period, setPeriod] = useState<PeriodValue>({ kind: "today", from: "", to: "" });
  const [serviceId, setServiceId] = useState<number | undefined>(undefined);
  const { data, error } = useSection("anchals", period, { serviceId }, getAnchalRows);
  const rows = data?.rows ?? [];

  useEffect(() => {
    onStamp?.(data ? (usableStamp(data.updatedAt) ?? usableStamp(data.retrievedAt) ?? "") : "");
  }, [data, onStamp]);

  const totals = rows.reduce(
    (a, r) => {
      a.received += r.received;
      a.completed += r.completed;
      a.pending += r.pending;
      a.amountPaise += r.amountPaise;
      return a;
    },
    { received: 0, completed: 0, pending: 0, amountPaise: 0 },
  );
  const disposal = totals.received ? (totals.completed / totals.received) * 100 : null;

  // Pinned to one service, a figure it does not record is left blank rather than
  // shown as 0 or "—": a blank says "not recorded for this service", a zero says
  // "nothing happened". The test is collection, never shape identity.
  const gate = (collected: (id: number) => boolean) => (value: string | number) =>
    serviceId === undefined || collected(serviceId) ? value : "";
  const queueCell = gate(movesPendingBalance);
  const amountCell = gate((id) => collects(id, "amountPaise"));

  const figure = "lg:text-right font-mono tabular-nums";
  const hAnchal = t("Anchal", "अंचल");
  const hReceived = t("Received", "प्राप्त");
  const hDisposed = t("Disposed", "निस्तारित");
  const hPending = t("Pending", "लंबित");
  const hDisposal = t("Disposal %", "निस्तारण %");
  const hCollected = t("Collected (₹)", "संग्रहित (₹)");
  const heads: [string, boolean][] = [
    [hAnchal, false],
    [hReceived, true],
    [hDisposed, true],
    [hPending, true],
    [hDisposal, true],
    [hCollected, true],
  ];

  return (
    <SectionCard
      id="anchals"
      title={t("Anchal-wise performance", "अंचलवार प्रदर्शन")}
      subtitle={t(
        "What each Anchal received, disposed and collected",
        "प्रत्येक अंचल में क्या प्राप्त हुआ, क्या निस्तारित हुआ और कितना संग्रह हुआ",
      )}
      filters={
        <>
          <PeriodPicker name="anchals" value={period} onChange={setPeriod} />
          <ServiceFilter
            id="anchals-service"
            value={serviceId}
            onChange={setServiceId}
            services={DAILY_SERVICES}
            allLabel={t(`All ${DAILY_SERVICES.length} services`, `सभी ${DAILY_SERVICES.length} सेवाएँ`)}
          />
        </>
      }
      error={error}
    >
      {data && (
      <Table
        role="table"
        className={cardTable}
        containerClassName={cardTableWrap}
        containerProps={scrollRegion(t("Anchal-wise performance table", "अंचलवार प्रदर्शन तालिका"))}
      >
        <thead role="rowgroup">
          <tr role="row">
            {heads.map(([h, numeric]) => (
              <Th key={h} className={numeric ? "lg:text-right" : undefined}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r) => (
            <tr role="row" key={r.officeId}>
              <Td label={hAnchal} className={cardTitle}>
                {hAnchal} {r.officeId}
              </Td>
              <Td label={hReceived} className={figure}>{queueCell(r.received)}</Td>
              <Td label={hDisposed} className={figure}>{queueCell(r.completed)}</Td>
              <Td label={hPending} className={figure}>{queueCell(r.pending)}</Td>
              <Td label={hDisposal} className={figure}>{queueCell(percent(r.disposalPct))}</Td>
              <Td label={hCollected} className={`${figure} lg:whitespace-nowrap`}>{amountCell(currency(r.amountPaise))}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot role="rowgroup">
          <tr role="row">
            <Td label={hAnchal} className={cardTitle}>{t("TOTAL", "कुल")}</Td>
            <Td label={hReceived} className={figure}>{queueCell(totals.received)}</Td>
            <Td label={hDisposed} className={figure}>{queueCell(totals.completed)}</Td>
            <Td label={hPending} className={figure}>{queueCell(totals.pending)}</Td>
            <Td label={hDisposal} className={figure}>{queueCell(percent(disposal))}</Td>
            <Td label={hCollected} className={`${figure} lg:whitespace-nowrap`}>{amountCell(currency(totals.amountPaise))}</Td>
          </tr>
        </tfoot>
      </Table>
      )}
    </SectionCard>
  );
}
