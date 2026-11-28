import { Badge, Button, Field, Notice, Panel, Table, Td, Th, cardTable, cardTableWrap, cardTitle, leadingBody, leadingHeading, leadingHelp, useScrollRegion } from "../ui";
import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MonitoringRow } from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { collects, dailyEntryCollects, movesPendingBalance } from "../../domain/service-kind";
import { api } from "../api";
import { Language, useText, runtimeText } from "../i18n";
import { formatIndiaDateTime } from "../lib/dates";
// The services the dashboard can be pinned to: the ones the daily entry collects.
// A pinned field-work service would have no figure left to show.
const OFFERED = services.filter((s) => dailyEntryCollects(s.id));
const currency = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
// A stamp we can print, or null. Never lets "Invalid Date" reach the screen.
const usableStamp = (v?: string | null) =>
  v && !Number.isNaN(new Date(v).getTime()) ? v : null;
const percent = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");
export default function Dashboard() {
  const lang = useContext(Language),
    t = useText(),
    scrollRegion = useScrollRegion();
  const [mode, setMode] = useState("day"),
    [from, setFrom] = useState(todayIST()),
    [to, setTo] = useState(todayIST()),
    [office, setOffice] = useState(""),
    [service, setService] = useState(""),
    [rows, setRows] = useState<MonitoringRow[]>([]),
    [updated, setUpdated] = useState(""),
    [error, setError] = useState("");
  const queryClient = useQueryClient();
  const query = new URLSearchParams({
    from,
    to,
    ...(office ? { officeId: office } : {}),
    ...(service ? { serviceId: service } : {}),
  }).toString();
  const loadRef = useRef<() => void>(() => {});
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", query],
    queryFn: () => api<{ rows: MonitoringRow[]; updatedAt: string; retrievedAt?: string }>("/dashboard?" + query),
  });
  useEffect(() => {
    if (dashboardQuery.data) {
      setRows(dashboardQuery.data.rows);
      setUpdated(usableStamp(dashboardQuery.data.updatedAt) ?? usableStamp(dashboardQuery.data.retrievedAt) ?? "");
      setError("");
    }
    if (dashboardQuery.error) {
      setError((dashboardQuery.error as Error).message);
      const status = (dashboardQuery.error as { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) {
        setRows([]);
        setUpdated("");
      }
    }
    loadRef.current = () => void dashboardQuery.refetch();
  }, [dashboardQuery.data, dashboardQuery.error, dashboardQuery.refetch]);
  // There is no live feed on the server, so these two are what keep the
  // dashboard current: a poll while the tab is visible, and a refresh on focus.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }, 15000);
    const focus = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", focus);
    };
  }, [queryClient]);
  const totals = rows.reduce(
    (a, r) => {
      for (const k of [
        "received",
        "completed",
        "pending",
        "amountPaise",
        "submitted",
        "expected",
      ] as const)
        a[k] += r[k];
      return a;
    },
    {
      received: 0,
      completed: 0,
      pending: 0,
      amountPaise: 0,
      submitted: 0,
      expected: 0,
    },
  );
  const disposal = totals.received
    ? (totals.completed / totals.received) * 100
    : null;
  // Each figure on this page is derived from a field a service either collects
  // or does not. Pinned to one service, a figure derived from a field it does
  // not collect is left blank rather than shown as 0 or "—": a blank says "not
  // collected for this service", a zero says "no work was done", and only one
  // of those is true. The test is collection, never shape identity: a service
  // that collects a queue and money (counterRevenue) owns figures from two
  // shapes, and an equality test would blank all of them.
  //   Received, Completed, Pending, Disposal %  the queue figures, kept for
  //     services whose balance moves (movesPendingBalance)
  //   Amount                                    collects(id, "amountPaise")
  // There is no work-done figure: the daily entry no longer collects field
  // work, so it would read zero, which says "no work was done". Field work is
  // reported as visits.
  const pinnedId = service === "" ? null : Number(service);
  const gate = (collected: (id: number) => boolean) => (value: string | number) =>
    pinnedId === null || collected(pinnedId) ? value : "";
  const queueCell = gate(movesPendingBalance);
  const amountCell = gate((id) => collects(id, "amountPaise"));
  // The services that feed a figure, so a note never counts fewer than the
  // figure spans. Counted by what they collect, not by shape: pending spans
  // counter and counterRevenue services, collection spans revenue and
  // counterRevenue services.
  const serviceCount = (feeds: (id: number) => boolean) => services.filter((x) => feeds(x.id)).length;
  // "Across N services" only says something when the figure really spans them;
  // pinned to one service the note falls back to what the figure is.
  const spans = (
    feeds: (id: number) => boolean,
    note: (n: number) => string,
    noteHi: (n: number) => string,
    fallbackEn: string,
    fallbackHi: string,
  ) => {
    const n = serviceCount(feeds);
    return pinnedId === null ? t(note(n), noteHi(n)) : t(fallbackEn, fallbackHi);
  };
  const metrics = [
    [
      t("Total pending", "कुल लंबित"),
      queueCell(totals.pending),
      spans(
        movesPendingBalance,
        (n) => `across ${n} ${n === 1 ? "service" : "services"} with a pending balance`,
        (n) => `लंबित शेष वाली ${n} ${n === 1 ? "सेवा" : "सेवाओं"} में`,
        "Closing balance",
        "अंतिम शेष",
      ),
    ],
    [
      t("Disposal", "निस्तारण"),
      queueCell(percent(disposal)),
      // The ratio under it is the same two queue figures, so it goes with them.
      queueCell(`${totals.completed} / ${totals.received}`),
    ],
    [
      t("Total collection", "कुल संग्रह"),
      amountCell(currency(totals.amountPaise)),
      spans(
        (id) => collects(id, "amountPaise"),
        (n) => `across ${n} ${n === 1 ? "service" : "services"} that collect an amount`,
        (n) => `राशि संग्रहित करने वाली ${n} ${n === 1 ? "सेवा" : "सेवाओं"} में`,
        "Actual collection",
        "वास्तविक संग्रह",
      ),
    ],
  ];
  // Filing status is about one day. Under any other period the heading must not
  // say "today", so it is named for what it is and the period is printed beneath.
  const isToday = from === todayIST() && to === todayIST();
  const filing = (r: MonitoringRow) =>
    !r.configured
      ? { tone: "neutral" as const, label: t("Not set up", "सेटअप नहीं हुआ") }
      : r.expected === 0
        ? { tone: "neutral" as const, label: t("Nothing due", "कुछ देय नहीं") }
        : r.submitted >= r.expected
          ? { tone: "settled" as const, label: t("Filed", "दर्ज") }
          : r.submitted === 0
            ? { tone: "attention" as const, label: t("Not filed", "दर्ज नहीं") }
            : { tone: "attention" as const, label: t("Partly filed", "आंशिक दर्ज") };
  const period = from + (from !== to ? " — " + to : "");

  const figure = "lg:text-right font-mono tabular-nums";
  const heading = `text-[15px] font-semibold ${leadingHeading} text-foreground`;
  const eyebrow = `text-[11px] font-medium uppercase tracking-[0.05em] [html[lang=hi]_&]:tracking-normal ${leadingBody} text-muted-foreground`;
  const anchalLabel = t("Anchal", "अंचल");
  const perAnchalHeads: [string, boolean][] = [
    [anchalLabel, false],
    // Neutral wording: these are queue figures, so naming transactions
    // would be wrong.
    [t("Received", "प्राप्त"), true],
    [t("Completed", "पूर्ण"), true],
    [t("Pending", "लंबित"), true],
    [t("Disposal %", "निस्तारण %"), true],
    [t("Amount Collected (₹)", "संग्रहित राशि (₹)"), true],
  ];
  const [hAnchal, hReceived, hCompleted, hPending, hDisposal, hAmount] = perAnchalHeads.map(([h]) => h);

  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-1.5">
        <div className={eyebrow}>{t("COMMISSIONER REVIEW", "आयुक्त समीक्षा")}</div>
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>
          {t("Office monitoring dashboard", "कार्यालय निगरानी डैशबोर्ड")}
        </h1>
        {updated && (
          <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
            {t(
              `Figures as of ${formatIndiaDateTime(updated)}`,
              `आंकड़े ${formatIndiaDateTime(updated)} तक`,
            )}
          </p>
        )}
      </header>

      <Panel className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <Field>
          {t("View", "दृश्य")}
          <select
            aria-label={t("View", "दृश्य")}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setFrom(
                e.target.value === "month"
                  ? todayIST().slice(0, 7) + "-01"
                  : todayIST(),
              );
              setTo(todayIST());
            }}
          >
            <option value="day">{t("Single day", "एक दिन")}</option>
            <option value="range">{t("Date range", "तिथि सीमा")}</option>
            <option value="month">{t("Monthly", "मासिक")}</option>
          </select>
        </Field>
        {mode === "month" ? (
          <Field>
            {t("Month", "महीना")}
            <input
              type="month"
              max={todayIST().slice(0, 7)}
              value={from.slice(0, 7)}
              onChange={(e) => {
                if (!e.target.value) return;
                const value = e.target.value;
                const end = new Date(
                  Number(value.slice(0, 4)),
                  Number(value.slice(5, 7)),
                  0,
                ).getDate();
                setFrom(value + "-01");
                setTo(
                  value === todayIST().slice(0, 7)
                    ? todayIST()
                    : value + "-" + end,
                );
              }}
            />
          </Field>
        ) : (
          <>
            <Field>
              {t(
                mode === "day" ? "Service date" : "From date",
                mode === "day" ? "सेवा तिथि" : "प्रारंभ तिथि",
              )}
              <input
                type="date"
                max={todayIST()}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (mode === "day") setTo(e.target.value);
                }}
              />
            </Field>
            {mode === "range" && (
              <Field>
                {t("To date", "अंतिम तिथि")}
                <input
                  type="date"
                  min={from}
                  max={todayIST()}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
        <Field>
          {anchalLabel}
          <select value={office} onChange={(e) => setOffice(e.target.value)}>
            <option value="">{t("All offices", "सभी कार्यालय")}</option>
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i + 1}>
                {anchalLabel} {i + 1}
              </option>
            ))}
          </select>
        </Field>
        <Field className="sm:col-span-2">
          {t("Service", "सेवा")}
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">{t(`All ${OFFERED.length} services`, `सभी ${OFFERED.length} सेवाएँ`)}</option>
            {OFFERED.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {lang === "hi" ? s.name : s.en}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="outline" onClick={() => loadRef.current()}>
          {t("Refresh", "रिफ्रेश")}
        </Button>
      </Panel>

      {error && (
        <Notice role="alert">
          {from > to
            ? t(
                "Start date must be on or before the end date.",
                "आरंभ तिथि समाप्ति तिथि से पहले या उसी दिन होनी चाहिए।",
              )
            : runtimeText(error, lang)}
        </Notice>
      )}

      <Panel aria-labelledby="filing-heading" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="filing-heading" className={heading}>
            {isToday ? t("Filed today", "आज दर्ज") : t("Filing status", "दर्ज स्थिति")}
          </h2>
          <p className={`text-[13px] ${leadingHelp} text-muted-foreground`}>
            {t("Services reported, out of those due, by Anchal", "अंचलवार दर्ज सेवाएँ, देय सेवाओं में से")}
            <span className={`ml-2 font-mono tabular-nums text-foreground`}>{period}</span>
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const status = filing(r);
            return (
              <li
                key={r.officeId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[7px] border border-border px-4 py-2.5"
              >
                <div className="grid min-w-0 gap-0.5">
                  <span className={`text-[13.5px] font-medium ${leadingBody} text-foreground`}>
                    {anchalLabel} {r.officeId}
                  </span>
                  <span className={`font-mono text-[12px] tabular-nums ${leadingHelp} text-muted-foreground`}>
                    {r.submitted} / {r.expected}
                  </span>
                </div>
                <Badge tone={status.tone} className="whitespace-nowrap">
                  {status.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div data-metrics="" className="grid gap-3 md:grid-cols-3 xl:gap-4">
        {metrics.map(([label, value, note]) => (
          <Panel key={label} data-metric="" className="grid content-start gap-1 p-4 sm:p-4">
            <span className={`text-[11px] font-medium ${leadingBody} text-muted-foreground`}>{label}</span>
            <strong
              className={`block min-h-[2.25rem] font-mono text-[26px] font-semibold tabular-nums ${leadingHeading} [overflow-wrap:anywhere] text-foreground`}
            >
              {value}
            </strong>
            <small className={`block text-[12px] ${leadingHelp} text-muted-foreground`}>{note}</small>
          </Panel>
        ))}
      </div>


      <Panel className="grid min-w-0 gap-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="grid min-w-0 gap-1">
            <div className={eyebrow}>{t("REPORT OVERVIEW", "रिपोर्ट अवलोकन")}</div>
            <h2 className={heading}>{t("Anchal-wise performance", "अंचलवार प्रदर्शन")}</h2>
            <p className={`text-[13px] ${leadingHelp} text-muted-foreground`}>
              {t("Activity totals and closing balances", "गतिविधि योग और अंतिम शेष")}
              <span className="ml-2 font-mono tabular-nums text-foreground">{period}</span>
            </p>
          </div>
          <Badge data-report-count="" className="whitespace-nowrap font-mono tabular-nums">
            {totals.submitted} / {totals.expected} {t("reports", "रिपोर्ट")}
          </Badge>
        </div>
        <Table
          role="table"
          className={cardTable}
          containerClassName={cardTableWrap}
          containerProps={scrollRegion(t("Anchal-wise performance table", "अंचलवार प्रदर्शन तालिका"))}
        >
          <thead role="rowgroup">
            <tr role="row">
              {perAnchalHeads.map(([h, numeric]) => (
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
                  {anchalLabel} {r.officeId}
                </Td>
                <Td label={hReceived} className={figure}>{queueCell(r.received)}</Td>
                <Td label={hCompleted} className={figure}>{queueCell(r.completed)}</Td>
                <Td label={hPending} className={figure}>{queueCell(r.pending)}</Td>
                <Td label={hDisposal} className={figure}>{queueCell(percent(r.disposalPct))}</Td>
                <Td label={hAmount} className={`${figure} lg:whitespace-nowrap`}>{amountCell(currency(r.amountPaise))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot role="rowgroup">
            <tr role="row">
              <Td label={hAnchal} className={cardTitle}>{t("TOTAL", "कुल")}</Td>
              <Td label={hReceived} className={figure}>{queueCell(totals.received)}</Td>
              <Td label={hCompleted} className={figure}>{queueCell(totals.completed)}</Td>
              <Td label={hPending} className={figure}>{queueCell(totals.pending)}</Td>
              <Td label={hDisposal} className={figure}>{queueCell(percent(disposal))}</Td>
              <Td label={hAmount} className={`${figure} lg:whitespace-nowrap`}>{amountCell(currency(totals.amountPaise))}</Td>
            </tr>
          </tfoot>
        </Table>
      </Panel>
    </div>
  );
}
