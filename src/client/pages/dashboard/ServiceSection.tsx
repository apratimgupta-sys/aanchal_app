import { useContext, useState } from "react";
import { Table, Td, Th, cardTable, cardTableWrap, cardTitle, leadingHelp, useScrollRegion } from "../../ui";
import { Language, useText } from "../../i18n";
import { collects, movesPendingBalance } from "../../../domain/service-kind";
import { DAILY_SERVICES, displayNumber } from "../../../domain/daily-entry-order";
import { formatCount } from "../../../domain/visit-cards";
import type { PeriodValue } from "../../../domain/period";
import type { ServiceRow } from "../../../shared/types";
import { getServiceRows } from "../../dashboard-data";
import PeriodPicker from "./PeriodPicker";
import { AnchalFilter } from "./Filters";
import SectionCard from "./SectionCard";
import { useSection } from "./useSection";
import { currency, percent } from "./format";

const zeros = (serviceId: number): ServiceRow => ({
  serviceId,
  received: 0,
  completed: 0,
  pending: 0,
  disposalPct: null,
  amountPaise: 0,
});

export default function ServiceSection() {
  const t = useText();
  const lang = useContext(Language);
  const scrollRegion = useScrollRegion();
  const [period, setPeriod] = useState<PeriodValue>({ kind: "today", from: "", to: "" });
  const [officeId, setOfficeId] = useState<number | undefined>(undefined);
  const { data, range, error } = useSection("services", period, { officeId }, getServiceRows);

  // A service the server did not send reads as zeros.
  const sent = new Map((data?.rows ?? []).map((r) => [r.serviceId, r]));
  const rows = DAILY_SERVICES.map((s) => ({ service: s, row: sent.get(s.id) ?? zeros(s.id) }));
  const largest = rows.reduce((m, { service, row }) => (movesPendingBalance(service.id) ? Math.max(m, row.pending) : m), 0);

  const queue = rows.filter(({ service }) => movesPendingBalance(service.id));
  const received = queue.reduce((a, { row }) => a + row.received, 0);
  const completed = queue.reduce((a, { row }) => a + row.completed, 0);
  const pending = queue.reduce((a, { row }) => a + row.pending, 0);
  const amountPaise = rows.reduce((a, { row }) => a + row.amountPaise, 0);

  const figure = "lg:text-right font-mono tabular-nums max-lg:empty:hidden";
  const hNo = t("No.", "क्र.");
  const hService = t("Service", "सेवा");
  const hReceived = t("Received", "प्राप्त");
  const hDisposed = t("Disposed", "निस्तारित");
  const hDisposal = t("Disposal %", "निस्तारण %");
  const hPending = t("Pending", "लंबित");
  const hCollected = t("Collected (₹)", "संग्रहित (₹)");
  const heads: [string, boolean][] = [
    [hNo, false],
    [hService, false],
    [hReceived, true],
    [hDisposed, true],
    [hDisposal, true],
    [hPending, true],
    [hCollected, true],
  ];
  const n = DAILY_SERVICES.length;

  return (
    <SectionCard
      id="services"
      range={range}
      title={t("Service-wise progress", "सेवावार प्रगति")}
      subtitle={t(
        `The ${n} daily services. A blank means the service does not record that figure.`,
        `${n} दैनिक सेवाएँ। खाली स्थान का अर्थ है कि वह सेवा यह आंकड़ा दर्ज नहीं करती।`,
      )}
      filters={
        <>
          <PeriodPicker name="services" value={period} onChange={setPeriod} />
          <AnchalFilter id="services-anchal" value={officeId} onChange={setOfficeId} />
        </>
      }
      error={error}
    >
      {data && (
      <Table
        role="table"
        className={cardTable}
        containerClassName={cardTableWrap}
        containerProps={scrollRegion(t("Service-wise progress table", "सेवावार प्रगति तालिका"))}
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
          {rows.map(({ service, row }) => {
            const queued = movesPendingBalance(service.id);
            return (
              <tr role="row" key={service.id}>
                <Td label={hNo} className="font-mono tabular-nums">{displayNumber(service.id)}</Td>
                <Td label={hService} className={cardTitle}>
                  {lang === "hi" ? service.name : service.en}
                  {!queued && (
                    <span className={`block text-xs ${leadingHelp} text-muted-foreground`}>
                      {t(`${formatCount(row.received)} payments`, `${formatCount(row.received)} भुगतान`)}
                    </span>
                  )}
                </Td>
                <Td label={hReceived} className={figure}>{queued ? formatCount(row.received) : ""}</Td>
                <Td label={hDisposed} className={figure}>{queued ? formatCount(row.completed) : ""}</Td>
                <Td label={hDisposal} className={figure}>{queued ? percent(row.disposalPct) : ""}</Td>
                <Td label={hPending} className={figure}>
                  {queued && (
                    <span className="inline-flex items-center gap-2 lg:justify-end">
                      <span aria-hidden="true" className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          data-pending-bar
                          className="block h-full bg-chart-1"
                          style={{ width: `${largest === 0 ? 0 : (row.pending / largest) * 100}%` }}
                        />
                      </span>
                      {formatCount(row.pending)}
                    </span>
                  )}
                </Td>
                <Td label={hCollected} className={`${figure} lg:whitespace-nowrap`}>
                  {collects(service.id, "amountPaise") ? currency(row.amountPaise) : ""}
                </Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot role="rowgroup">
          <tr role="row">
            <Td label={hNo} className="max-lg:hidden">{""}</Td>
            <Td label={hService} className={cardTitle}>{t("TOTAL", "कुल")}</Td>
            <Td label={hReceived} className={figure}>{formatCount(received)}</Td>
            <Td label={hDisposed} className={figure}>{formatCount(completed)}</Td>
            <Td label={hDisposal} className={figure}>{percent(received === 0 ? null : (completed / received) * 100)}</Td>
            <Td label={hPending} className={figure}>{formatCount(pending)}</Td>
            <Td label={hCollected} className={`${figure} lg:whitespace-nowrap`}>{currency(amountPaise)}</Td>
          </tr>
        </tfoot>
      </Table>
      )}
    </SectionCard>
  );
}
