import { Badge, Button, Field, Notice, Panel, Table, leadingBody, leadingHeading, leadingHelp } from "../ui";
import { cn } from "../lib/utils";
import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MonitoringRow, EntryView } from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { formShape, type FormShape } from "../../domain/service-kind";
import { api } from "../api";
import { FORM_REDUCED_ON, Language, useText, runtimeText } from "../i18n";
import { formatIndiaDateTime } from "../lib/dates";
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
// One column per figure, three shapes in the rows below: received is cases or
// transactions, and completed is disposals or work done, so both labels name both.
const registerHeads: [string, string, boolean][] = [
  ["Service date", "सेवा तिथि", false],
  ["Reporting date", "रिपोर्टिंग तिथि", false],
  ["Registered at", "पंजीकरण समय", false],
  ["Anchal", "अंचल", false],
  ["Ward", "वार्ड", false],
  ["Service No", "सेवा संख्या", true],
  ["Service", "सेवा", false],
  ["Opening Pending", "प्रारंभिक लंबित", true],
  ["Received / Transactions", "प्राप्त / लेन-देन", true],
  ["Completed / Work done", "पूर्ण / किया गया कार्य", true],
  ["Amount (₹)", "राशि (₹)", true],
  ["Remarks", "टिप्पणियाँ", false],
];
export default function Dashboard() {
  const lang = useContext(Language),
    t = useText();
  const [mode, setMode] = useState("day"),
    [from, setFrom] = useState(todayIST()),
    [to, setTo] = useState(todayIST()),
    [office, setOffice] = useState(""),
    [service, setService] = useState(""),
    [rows, setRows] = useState<MonitoringRow[]>([]),
    [updated, setUpdated] = useState(""),
    [error, setError] = useState(""),
    [details, setDetails] = useState<EntryView[] | null>(null);
  const queryClient = useQueryClient();
  const query = new URLSearchParams({
    from,
    to,
    ...(office ? { officeId: office } : {}),
    ...(service ? { serviceId: service } : {}),
  }).toString();
  const loadRef = useRef<() => void>(() => {});
  const detailsOpen = useRef(false);
  const activeQuery = useRef(query);
  activeQuery.current = query;
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", query],
    queryFn: () => api<{ rows: MonitoringRow[]; updatedAt: string; retrievedAt?: string }>("/dashboard?" + query),
  });
  useEffect(() => {
    detailsOpen.current = false;
    setDetails(null);
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
        "workDone",
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
      workDone: 0,
      submitted: 0,
      expected: 0,
    },
  );
  const disposal = totals.received
    ? (totals.completed / totals.received) * 100
    : null;
  // Every figure on this page belongs to exactly one shape: Received,
  // Completed, Pending and Disposal % to counter work, the amount to revenue,
  // work done to field work. Pinned to a single service, the figures the other
  // two shapes own are not collected at all, so they are left blank rather than
  // shown as 0 or — : a blank says "not collected for this service", a zero
  // says "no work was done", and only one of those is true. Same treatment the
  // register already gives Opening Pending.
  const pinnedShape = service === "" ? null : formShape(Number(service));
  const onlyFor =
    (shape: FormShape) =>
    (value: string | number) =>
      pinnedShape === null || pinnedShape === shape ? value : "";
  const counterCell = onlyFor("counter");
  const revenueCell = onlyFor("revenue");
  const fieldWorkCell = onlyFor("fieldwork");
  const shapeCount = (shape: FormShape) => services.filter((x) => formShape(x.id) === shape).length;
  // "Across N services" only says something when the figure really spans them;
  // pinned to one service the note falls back to what the figure is.
  const spans = (shape: FormShape, en: string, hi: string, fallbackEn: string, fallbackHi: string) =>
    pinnedShape === null
      ? t(`across ${shapeCount(shape)} ${en}`, `${shapeCount(shape)} ${hi} में`)
      : t(fallbackEn, fallbackHi);
  const metrics = [
    [
      t("Total pending", "कुल लंबित"),
      counterCell(totals.pending),
      spans("counter", "counter services", "काउंटर सेवाओं", "Closing balance", "अंतिम शेष"),
    ],
    [
      t("Disposal", "निस्तारण"),
      counterCell(percent(disposal)),
      // The ratio under it is the same two counter figures, so it goes with them.
      counterCell(`${totals.completed} / ${totals.received}`),
    ],
    [
      t("Total collection", "कुल संग्रह"),
      revenueCell(currency(totals.amountPaise)),
      spans("revenue", "revenue services", "राजस्व सेवाओं", "Actual collection", "वास्तविक संग्रह"),
    ],
    [
      t("Work done this period", "इस अवधि में किया गया कार्य"),
      fieldWorkCell(totals.workDone),
      spans("fieldwork", "field-work services", "क्षेत्रीय कार्य सेवाओं", "Field work completed", "पूर्ण क्षेत्रीय कार्य"),
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

  // Below lg a row becomes a card and every cell carries its own header through
  // data-label, so no column is dropped; at lg and up it is an ordinary table that
  // scrolls inside its own container. One DOM serves both. Explicit roles keep the
  // table semantics that display:block/grid would otherwise strip in Safari.
  const cardTable = [
    "max-lg:block max-lg:[&_thead]:sr-only",
    "max-lg:[&_tbody]:grid max-lg:[&_tbody]:gap-3 max-lg:[&_tfoot]:grid max-lg:[&_tfoot]:mt-3",
    "max-lg:[&_tr]:grid max-lg:[&_tr]:gap-y-2 max-lg:[&_tr]:rounded-lg max-lg:[&_tr]:border max-lg:[&_tr]:border-border max-lg:[&_tr]:bg-card max-lg:[&_tr]:p-4",
    "max-lg:[&_tbody_tr+tr]:border-border max-lg:[&_td]:p-0 max-lg:[&_tfoot_tr]:bg-muted",
    "[&_td]:align-top lg:[&_tfoot_td]:border-t lg:[&_tfoot_td]:border-border lg:[&_tfoot_td]:bg-muted lg:[&_tfoot_td]:font-medium",
  ].join(" ");
  const cardWrap = "max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent";
  const cell = [
    "max-lg:flex max-lg:items-baseline max-lg:justify-between max-lg:gap-4 max-lg:[overflow-wrap:anywhere]",
    "max-lg:before:shrink-0 max-lg:before:content-[attr(data-label)] max-lg:before:text-[11px] max-lg:before:font-medium max-lg:before:font-sans max-lg:before:text-left max-lg:before:text-muted-foreground",
  ].join(" ");
  const figure = "lg:text-right font-mono tabular-nums";
  const title = "max-lg:block max-lg:before:hidden max-lg:font-medium";
  const stacked = "max-lg:grid max-lg:justify-normal max-lg:gap-0.5";
  const Td = ({ label, className, children }: { label: string; className?: string; children?: React.ReactNode }) => (
    <td role="cell" data-label={label} className={cn(cell, className)}>
      {children}
    </td>
  );
  const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th role="columnheader" scope="col" className={cn("text-left", className)}>
      {children}
    </th>
  );
  const heading = `text-[15px] font-semibold ${leadingHeading} text-foreground`;
  const eyebrow = `text-[11px] font-medium uppercase tracking-[0.05em] [html[lang=hi]_&]:tracking-normal ${leadingBody} text-muted-foreground`;
  const anchalLabel = t("Anchal", "अंचल");
  const perAnchalHeads: [string, boolean][] = [
    [anchalLabel, false],
    // Neutral wording: these three are counter-shape figures
    // only, so naming transactions or field work would be wrong.
    [t("Received", "प्राप्त"), true],
    [t("Completed", "पूर्ण"), true],
    [t("Pending", "लंबित"), true],
    [t("Disposal %", "निस्तारण %"), true],
    // Field work has no place in the four above, and without a
    // column of its own it can only be read as a cross-office
    // total, so no Anchal can be compared with another.
    [t("Work done", "किया गया कार्य"), true],
    [t("Amount Collected (₹)", "संग्रहित राशि (₹)"), true],
    [t("Remarks / Review", "टिप्पणियाँ / समीक्षा"), false],
  ];
  const [hAnchal, hReceived, hCompleted, hPending, hDisposal, hWork, hAmount, hRemarks] = perAnchalHeads.map(([h]) => h);

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
            <option value="">{t("All 25 services", "सभी 25 सेवाएँ")}</option>
            {services.map((s) => (
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

      {/* Fewer fields are collected from this date on, so figures fall at
          the cutover. Without saying so, that reads as a fall in work. And
          the ledger is derived on read, so an October period is recomputed
          on today's shape rules too — saying only "not comparable" would
          imply the earlier figures are as they were filed. */}
      <p className={`max-w-3xl rounded-[7px] border border-border bg-muted px-3 py-2 text-[13px] ${leadingHelp} text-muted-foreground`}>
        {t(
          `Form fields were reduced on ${FORM_REDUCED_ON.en} — figures before and after this date are not comparable, and every period, earlier ones included, is now calculated on the reduced basis.`,
          `फॉर्म के फ़ील्ड ${FORM_REDUCED_ON.hi} को कम किए गए — इस तिथि से पहले और बाद के आंकड़े तुलनीय नहीं हैं, और हर अवधि की गणना, पिछली अवधियों की भी, अब घटे हुए आधार पर होती है।`,
        )}
      </p>

      <div data-metrics="" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
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
          containerClassName={cardWrap}
          containerProps={{
            tabIndex: 0,
            role: "region",
            "aria-label": t("Anchal-wise performance table", "अंचलवार प्रदर्शन तालिका"),
          }}
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
                <Td label={hAnchal} className={title}>
                  {anchalLabel} {r.officeId}
                </Td>
                <Td label={hReceived} className={figure}>{counterCell(r.received)}</Td>
                <Td label={hCompleted} className={figure}>{counterCell(r.completed)}</Td>
                <Td label={hPending} className={figure}>{counterCell(r.pending)}</Td>
                <Td label={hDisposal} className={figure}>{counterCell(percent(r.disposalPct))}</Td>
                <Td label={hWork} className={figure}>{fieldWorkCell(r.workDone)}</Td>
                <Td label={hAmount} className={`${figure} lg:whitespace-nowrap`}>{currency(r.amountPaise)}</Td>
                <Td label={hRemarks} className={stacked}>
                  {r.reviewReasons.length > 1 ? (
                    <details>
                      <summary
                        className={`flex min-h-[44px] cursor-pointer items-center rounded-[7px] text-[13.5px] font-medium ${leadingBody} text-warning focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                      >
                        {runtimeText(r.reviewReasons[0], lang)} {t(`+${r.reviewReasons.length - 1} more`, `+${r.reviewReasons.length - 1} और`)}
                      </summary>
                      {r.reviewReasons.map((reason) => (
                        <p key={reason} className={`pb-2 text-[13px] ${leadingHelp} text-foreground`}>
                          {runtimeText(reason, lang)}
                        </p>
                      ))}
                    </details>
                  ) : r.reviewReasons.length === 1 ? (
                    <span className={`text-[13.5px] font-medium ${leadingBody} text-warning`}>
                      {runtimeText(r.reviewReasons[0], lang)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("No threshold flags", "कोई सीमा चेतावनी नहीं")}</span>
                  )}
                  {r.configured && r.expected > 0 && r.submitted === 0 ? (
                    <small className={`block text-[12px] ${leadingHelp} text-warning`}>
                      {isToday ? t("Nothing filed today", "आज कुछ दर्ज नहीं") : t("Nothing filed", "कुछ दर्ज नहीं")}
                    </small>
                  ) : (
                    r.submitted < r.expected && (
                      <small className={`block text-[12px] ${leadingHelp} text-warning`}>
                        {t("Reporting incomplete", "रिपोर्टिंग अपूर्ण")}
                      </small>
                    )
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot role="rowgroup">
            <tr role="row">
              <Td label={hAnchal} className={title}>{t("TOTAL", "कुल")}</Td>
              <Td label={hReceived} className={figure}>{counterCell(totals.received)}</Td>
              <Td label={hCompleted} className={figure}>{counterCell(totals.completed)}</Td>
              <Td label={hPending} className={figure}>{counterCell(totals.pending)}</Td>
              <Td label={hDisposal} className={figure}>{counterCell(percent(disposal))}</Td>
              <Td label={hWork} className={figure}>{fieldWorkCell(totals.workDone)}</Td>
              <Td label={hAmount} className={`${figure} lg:whitespace-nowrap`}>{currency(totals.amountPaise)}</Td>
              {/* A bare dash carries nothing; on the phone card it is left out. */}
              <Td label={hRemarks} className="max-lg:hidden">—</Td>
            </tr>
          </tfoot>
        </Table>
        <Button
          variant="outline"
          className="justify-self-start max-sm:justify-self-stretch"
          onClick={async () => {
            try {
              const requestedQuery = query;
              const detailRows = await api<EntryView[]>(
                "/dashboard/entries?" + query,
              );
              if (activeQuery.current === requestedQuery) {
                detailsOpen.current = true;
                setDetails(detailRows);
              }
            } catch (e) {
              setError((e as Error).message);
              toast.error(t("Could not load service entries", "सेवा प्रविष्टियाँ लोड नहीं हो सकीं"));
            }
          }}
        >
          {t(
            "View service entries and remarks →",
            "सेवा प्रविष्टियाँ और टिप्पणियाँ देखें →",
          )}
        </Button>
      </Panel>

      {details && (
        <Panel data-register="" className="grid min-w-0 gap-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 className={heading}>{t("Service entry register", "सेवा प्रविष्टि रजिस्टर")}</h2>
            <Button
              variant="outline"
              onClick={() => {
                detailsOpen.current = false;
                setDetails(null);
              }}
            >
              {t("Close", "बंद करें")}
            </Button>
          </div>
          <Table
            role="table"
            className={cardTable}
            containerClassName={cardWrap}
            containerProps={{
              tabIndex: 0,
              role: "region",
              "aria-label": t("Service entry register table", "सेवा प्रविष्टि रजिस्टर तालिका"),
            }}
          >
            <thead role="rowgroup">
              <tr role="row">
                {registerHeads.map(([en, hi, numeric]) => (
                  <Th key={en} className={numeric ? "lg:text-right" : undefined}>
                    {t(en, hi)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {details.map((e) => {
                const label = (i: number) => t(registerHeads[i][0], registerHeads[i][1]);
                return (
                  <tr role="row" key={e.id}>
                    <Td label={label(0)}>{e.serviceDate}</Td>
                    <Td label={label(1)}>{e.reportingDate}</Td>
                    <Td label={label(2)} className="lg:whitespace-nowrap">{formatIndiaDateTime(e.createdAt)}</Td>
                    <Td label={label(3)}>{e.officeId}</Td>
                    <Td label={label(4)}>{e.ward}</Td>
                    <Td label={label(5)} className={figure}>{e.serviceId}</Td>
                    <Td label={label(6)} className="max-lg:order-first max-lg:block max-lg:font-medium max-lg:before:hidden">
                      {lang === "hi"
                        ? services[e.serviceId - 1].name
                        : services[e.serviceId - 1].en}
                    </Td>
                    {/* Blank, not 0: the service balance of a revenue or
                        field-work service is frozen and means nothing. */}
                    <Td label={label(7)} className={figure}>
                      {formShape(e.serviceId) === "counter" ? e.opening.service : ""}
                    </Td>
                    <Td label={label(8)} className={figure}>{e.received}</Td>
                    <Td label={label(9)} className={figure}>{e.completed}</Td>
                    <Td label={label(10)} className={`${figure} lg:whitespace-nowrap`}>{currency(e.amountPaise)}</Td>
                    <Td label={label(11)} className={stacked}>{e.remarks || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {!details.length && (
            <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
              {t(
                "No entries submitted for this period.",
                "इस अवधि के लिए कोई प्रविष्टि जमा नहीं है।",
              )}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
