import { useContext, useEffect, useRef, useState } from "react";
import type { MonitoringRow, EntryView } from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { api } from "../api";
import { Language, useText, runtimeText } from "../i18n";
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
  const sequence = useRef(0);
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
  useEffect(() => {
    detailsOpen.current = false;
    setDetails(null);
    let active = true;
    const refresh = async () => {
      const n = ++sequence.current;
      try {
        const data = await api<{ rows: MonitoringRow[]; updatedAt: string }>(
          "/dashboard?" + query,
        );
        if (active && n === sequence.current) {
          setRows(data.rows);
          setUpdated(data.updatedAt);
          setError("");
          if (detailsOpen.current) {
            const detailRows = await api<EntryView[]>(
              "/dashboard/entries?" + query,
            );
            if (active && n === sequence.current && detailsOpen.current)
              setDetails(detailRows);
          }
        }
      } catch (e) {
        if (active && n === sequence.current) setError((e as Error).message);
      }
    };
    loadRef.current = () => void refresh();
    void refresh();
    return () => {
      active = false;
    };
  }, [query]);
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
        loadRef.current();
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        loadRef.current();
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
      if (document.visibilityState === "visible") loadRef.current();
    }, 15000);
    const focus = () => loadRef.current();
    window.addEventListener("focus", focus);
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      clearInterval(fallback);
      window.removeEventListener("focus", focus);
      ws?.close();
    };
  }, []);
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
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t("COMMISSIONER REVIEW", "आयुक्त समीक्षा")}
          </div>
          <h1>
            {t("Office monitoring dashboard", "कार्यालय निगरानी डैशबोर्ड")}
          </h1>
          <p>
            {t(
              "Service delivery, collections and outstanding work across six Anchal offices.",
              "छह अंचल कार्यालयों की सेवा वितरण, संग्रह और लंबित कार्य की स्थिति।",
            )}
          </p>
        </div>
        <div className="live-status">
          <span className="live-dot" />{" "}
          {t(
            status,
            status === "Connected"
              ? "कनेक्टेड"
              : status === "Connecting"
                ? "जुड़ रहा है"
                : "पुनः जुड़ रहा है",
          )}
          <small>
            {updated
              ? t("Updated ", "अपडेट ") +
                new Date(updated).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })
              : t("Awaiting data", "डेटा की प्रतीक्षा")}
          </small>
        </div>
      </div>
      <section className="panel filters">
        <label>
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
        </label>
        {mode === "month" ? (
          <label>
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
          </label>
        ) : (
          <>
            <label>
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
            </label>
            {mode === "range" && (
              <label>
                {t("To date", "अंतिम तिथि")}
                <input
                  type="date"
                  min={from}
                  max={todayIST()}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <label>
          {t("Anchal", "अंचल")}
          <select value={office} onChange={(e) => setOffice(e.target.value)}>
            <option value="">{t("All offices", "सभी कार्यालय")}</option>
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i + 1}>
                {t("Anchal", "अंचल")} {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="service-filter">
          {t("Service", "सेवा")}
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">{t("All 25 services", "सभी 25 सेवाएँ")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {lang === "hi" ? s.name : s.en}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => loadRef.current()}>
          {t("Refresh", "रिफ्रेश")}
        </button>
      </section>
      {error && (
        <p role="alert" className="message">
          {runtimeText(error, lang)}
        </p>
      )}
      <div className="metrics">
        {metrics.map(([label, value, note]) => (
          <section key={label} className="metric">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("Anchal-wise performance", "अंचलवार प्रदर्शन")}</h2>
            <p className="small">
              {from}
              {from !== to ? " — " + to : ""} ·{" "}
              {t(
                "Activity totals and closing balances",
                "गतिविधि योग और अंतिम शेष",
              )}
            </p>
          </div>
          <span className="status-tag">
            {totals.submitted} / {totals.expected} {t("reports", "रिपोर्ट")}
          </span>
        </div>
        <div className="table-wrap">
          <table className="monitoring-table">
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
                    <small>
                      {r.configured
                        ? `${r.submitted} / ${r.expected} ${t("submitted", "जमा")}`
                        : t("Setup missing", "सेटअप शेष")}
                    </small>
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
                        <summary>
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
                      <small>
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
        <div className="table-notes">
          <p>
            {t(
              "Disposal = completed ÷ received. Clearing earlier backlog may exceed 100%. “—” means not applicable.",
              "निस्तारण = पूर्ण ÷ प्राप्त। पुराने लंबित कार्य पूर्ण करने पर 100% से अधिक हो सकता है। “—” का अर्थ लागू नहीं है।",
            )}
          </p>
          <p>
            {t(
              "Pending values are recorded closing balances; missing reports may hide unreported activity. Review thresholds follow the reference workbook.",
              "लंबित मान दर्ज अंतिम शेष हैं; अनुपस्थित रिपोर्ट में गतिविधि दर्ज नहीं हो सकती। समीक्षा सीमाएँ संदर्भ कार्यपुस्तिका के अनुसार हैं।",
            )}
          </p>
        </div>
        <button
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
            }
          }}
        >
          {t(
            "View service entries and remarks →",
            "सेवा प्रविष्टियाँ और टिप्पणियाँ देखें →",
          )}
        </button>
      </section>
      {details && (
        <section className="panel details-panel">
          <div className="section-heading">
            <h2>{t("Service entry register", "सेवा प्रविष्टि रजिस्टर")}</h2>
            <button
              onClick={() => {
                detailsOpen.current = false;
                setDetails(null);
              }}
            >
              {t("Close", "बंद करें")}
            </button>
          </div>
          <div className="table-wrap">
            <table>
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
                      {new Date(e.createdAt).toLocaleString(
                        lang === "hi" ? "hi-IN" : "en-IN",
                        { timeZone: "Asia/Kolkata" },
                      )}
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
              <p className="empty">
                {t(
                  "No entries submitted for this period.",
                  "इस अवधि के लिए कोई प्रविष्टि जमा नहीं है।",
                )}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
