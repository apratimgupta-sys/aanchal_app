import { Field, Panel, Notice } from "../ui";
import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MonitoringRow, EntryView } from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { api } from "../api";
import { Language, useText, runtimeText } from "../i18n";
import { formatIndiaDateTime } from "../lib/dates";
const currency = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
const percent = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");
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
    [status, setStatus] = useState("Connecting"),
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
    queryFn: () => api<{ rows: MonitoringRow[]; updatedAt: string }>("/dashboard?" + query),
  });
  useEffect(() => {
    detailsOpen.current = false;
    setDetails(null);
    if (dashboardQuery.data) {
      setRows(dashboardQuery.data.rows);
      setUpdated(dashboardQuery.data.updatedAt);
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
  useEffect(() => {
    let closed = false;
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let heartbeat: ReturnType<typeof setInterval>;
    let attempt = 0;
    const connect = () => {
      if (closed) return;
      setStatus("Connecting");
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/live`,
      );
      ws.onopen = () => {
        attempt = 0;
        setStatus("Connected");
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("Reconnecting");
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    heartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
    }, 20000);
    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }, 15000);
    const focus = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    window.addEventListener("focus", focus);
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      clearInterval(fallback);
      window.removeEventListener("focus", focus);
      ws?.close();
    };
  }, [queryClient]);
  const totals = rows.reduce(
    (a, r) => {
      for (const k of [
        "received",
        "completed",
        "slaWithinTime",
        "pending",
        "amountPaise",
        "complaintsPending",
        "fieldPending",
        "submitted",
        "expected",
      ] as const)
        a[k] += r[k];
      return a;
    },
    {
      received: 0,
      completed: 0,
      slaWithinTime: 0,
      pending: 0,
      amountPaise: 0,
      complaintsPending: 0,
      fieldPending: 0,
      submitted: 0,
      expected: 0,
    },
  );
  const disposal = totals.received
      ? (totals.completed / totals.received) * 100
      : null,
    sla = totals.completed
      ? (totals.slaWithinTime / totals.completed) * 100
      : null;
  const metrics = [
    [
      t("Total pending", "कुल लंबित"),
      totals.pending,
      t("Closing balance", "अंतिम शेष"),
    ],
    [
      t("Disposal", "निस्तारण"),
      percent(disposal),
      `${totals.completed} / ${totals.received}`,
    ],
    [
      t("Within SLA", "समय सीमा में"),
      percent(sla),
      t("Of completed work", "पूर्ण कार्य में से"),
    ],
    [
      t("Total collection", "कुल संग्रह"),
      currency(totals.amountPaise),
      t("Actual collection", "वास्तविक संग्रह"),
    ],
    [
      t("Complaints pending", "लंबित शिकायतें"),
      totals.complaintsPending,
      t("Closing balance", "अंतिम शेष"),
    ],
    [
      t("Field tasks pending", "लंबित क्षेत्रीय कार्य"),
      totals.fieldPending,
      t("Closing balance", "अंतिम शेष"),
    ],
  ];
  return (
    <>
      <div className="page-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
        <div>
          <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
            {t("COMMISSIONER REVIEW", "आयुक्त समीक्षा")}
          </div>
          <h1 className="ux4g-heading-xl-strong">
            {t("Office monitoring dashboard", "कार्यालय निगरानी डैशबोर्ड")}
          </h1>
        </div>
      </div>
      <Panel className="panel filters">
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
          {t("Anchal", "अंचल")}
          <select value={office} onChange={(e) => setOffice(e.target.value)}>
            <option value="">{t("All offices", "सभी कार्यालय")}</option>
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i + 1}>
                {t("Anchal", "अंचल")} {i + 1}
              </option>
            ))}
          </select>
        </Field>
        <Field className="service-filter">
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
        <button
          className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
          onClick={() => loadRef.current()}
        >
          {t("Refresh", "रिफ्रेश")}
        </button>
      </Panel>
      {error && (
        <Notice role="alert" className="message">
          {from > to
            ? t(
                "Start date must be on or before the end date.",
                "आरंभ तिथि समाप्ति तिथि से पहले या उसी दिन होनी चाहिए।",
              )
            : runtimeText(error, lang)}
        </Notice>
      )}
      <div className="metrics">
        {metrics.map(([label, value, note]) => (
          <Panel key={label} className="metric">
            <span>{label}</span>
            <strong className="ux4g-heading-xl-strong">{value}</strong>
            <small className="ux4g-d-block ux4g-mt-xs">{note}</small>
          </Panel>
        ))}
      </div>
      <Panel className="panel">
        <div className="section-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
          <div>
            <div className="section-eyebrow">{t("REPORT OVERVIEW", "रिपोर्ट अवलोकन")}</div>
            <h2 className="ux4g-heading-m-strong section-title">
              {t("Anchal-wise performance", "अंचलवार प्रदर्शन")}
            </h2>
            <p className="section-subtitle">
              {t("Activity totals and closing balances", "गतिविधि योग और अंतिम शेष")}
              <span className="section-date">{from}{from !== to ? " — " + to : ""}</span>
            </p>
          </div>
          <span className="status-tag report-count">
            {totals.submitted} / {totals.expected} {t("reports", "रिपोर्ट")}
          </span>
        </div>
        <div className="table-wrap ux4g-table-responsive" tabIndex={0} aria-label={t("Anchal-wise performance table", "अंचलवार प्रदर्शन तालिका")}>
          <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows monitoring-table">
            <thead>
              <tr>
                {[
                  t("Anchal", "अंचल"),
                  t("Requests / Transactions", "प्राप्त / लेन-देन"),
                  t("Disposed / Completed", "निस्तारित / पूर्ण"),
                  t("Pending", "लंबित"),
                  t("Disposal %", "निस्तारण %"),
                  t("SLA %", "समय सीमा %"),
                  t("Amount Collected (₹)", "संग्रहित राशि (₹)"),
                  t("Complaints Pending", "लंबित शिकायतें"),
                  t("Field Tasks Pending", "लंबित क्षेत्रीय कार्य"),
                  t("Remarks / Review", "टिप्पणियाँ / समीक्षा"),
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.officeId}>
                  <td>
                    <strong>
                      {t("Anchal", "अंचल")} {r.officeId}
                    </strong>
                  </td>
                  <td>{r.received}</td>
                  <td>{r.completed}</td>
                  <td>{r.pending}</td>
                  <td>{percent(r.disposalPct)}</td>
                  <td>{percent(r.slaPct)}</td>
                  <td className="nowrap">{currency(r.amountPaise)}</td>
                  <td>{r.complaintsPending}</td>
                  <td>{r.fieldPending}</td>
                  <td className="review-cell">
                    {r.reviewReasons.length ? (
                      <details>
                        <summary className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-l">
                          {t("REVIEW", "समीक्षा")} ({r.reviewReasons.length})
                        </summary>
                        {r.reviewReasons.map((reason) => (
                          <p key={reason}>{runtimeText(reason, lang)}</p>
                        ))}
                      </details>
                    ) : (
                      t("No threshold flags", "कोई सीमा चेतावनी नहीं")
                    )}
                    {r.submitted < r.expected && (
                      <small className="ux4g-d-block ux4g-mt-xs">
                        {t("Reporting incomplete", "रिपोर्टिंग अपूर्ण")}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t("TOTAL", "कुल")}</td>
                <td>{totals.received}</td>
                <td>{totals.completed}</td>
                <td>{totals.pending}</td>
                <td>{percent(disposal)}</td>
                <td>{percent(sla)}</td>
                <td className="nowrap">{currency(totals.amountPaise)}</td>
                <td>{totals.complaintsPending}</td>
                <td>{totals.fieldPending}</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          className="ui-button ui-button-secondary details-trigger"
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
        </button>
      </Panel>
      {details && (
        <Panel className="panel details-panel">
          <div className="section-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
            <h2 className="ux4g-heading-m-strong">
              {t("Service entry register", "सेवा प्रविष्टि रजिस्टर")}
            </h2>
            <button
              className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
              onClick={() => {
                detailsOpen.current = false;
                setDetails(null);
              }}
            >
              {t("Close", "बंद करें")}
            </button>
          </div>
          <div className="table-wrap ux4g-table-responsive" tabIndex={0} aria-label={t("Service entry register table", "सेवा प्रविष्टि रजिस्टर तालिका")}>
            <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows">
              <thead>
                <tr>
                  {[
                    ["Service date", "सेवा तिथि"],
                    ["Reporting date", "रिपोर्टिंग तिथि"],
                    ["Registered at", "पंजीकरण समय"],
                    ["Anchal", "अंचल"],
                    ["Ward", "वार्ड"],
                    ["Service No", "सेवा संख्या"],
                    ["Service", "सेवा"],
                    ["Opening Pending", "प्रारंभिक लंबित"],
                    ["Received", "प्राप्त"],
                    ["Completed", "पूर्ण"],
                    ["SLA Within Time", "समय सीमा में पूर्ण"],
                    ["Amount (₹)", "राशि (₹)"],
                    ["Complaints Received", "प्राप्त शिकायतें"],
                    ["Complaints Resolved", "निस्तारित शिकायतें"],
                    ["Field Received", "प्राप्त क्षेत्रीय कार्य"],
                    ["Field Completed", "पूर्ण क्षेत्रीय कार्य"],
                    ["Avg Days", "औसत दिन"],
                    ["Remarks", "टिप्पणियाँ"],
                  ].map(([en, hi]) => (
                    <th key={en}>{t(en, hi)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {details.map((e) => (
                  <tr key={e.id}>
                    <td>{e.serviceDate}</td>
                    <td>{e.reportingDate}</td>
                    <td>
                      {formatIndiaDateTime(e.createdAt)}
                    </td>
                    <td>{e.officeId}</td>
                    <td>{e.ward}</td>
                    <td>{e.serviceId}</td>
                    <td>
                      {lang === "hi"
                        ? services[e.serviceId - 1].name
                        : services[e.serviceId - 1].en}
                    </td>
                    <td>{e.opening.service}</td>
                    <td>{e.received}</td>
                    <td>{e.completed}</td>
                    <td>{e.slaWithinTime}</td>
                    <td>{currency(e.amountPaise)}</td>
                    <td>{e.complaintsReceived}</td>
                    <td>{e.complaintsResolved}</td>
                    <td>{e.fieldReceived}</td>
                    <td>{e.fieldCompleted}</td>
                    <td>{e.avgDisposalDays ?? "—"}</td>
                    <td>{e.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!details.length && (
              <p className="empty ux4g-body-m-default ux4g-text-neutral-secondary ux4g-p-xl">
                {t(
                  "No entries submitted for this period.",
                  "इस अवधि के लिए कोई प्रविष्टि जमा नहीं है।",
                )}
              </p>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
