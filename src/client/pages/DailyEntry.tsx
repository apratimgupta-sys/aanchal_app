import { useContext, useEffect, useState, useRef } from "react";
import type {
  Balances,
  EntryInput,
  EntryView,
  Setup,
} from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST, parseMoney, applyActivity } from "../../domain/ledger";
import { api, RequestError } from "../api";
import { Language, useText, runtimeText } from "../i18n";
import { mutationIntent, type MutationIntent } from "../mutation";
import InitialBalances from "./InitialBalances";
const numeric = [
  ["received", "Received / Transactions", "प्राप्त / लेन-देन"],
  ["completed", "Disposed / Completed", "निस्तारित / पूर्ण"],
  ["slaWithinTime", "SLA Within Time", "समय सीमा में पूर्ण"],
  ["complaintsReceived", "Complaints Received", "प्राप्त शिकायतें"],
  ["complaintsResolved", "Complaints Resolved", "निस्तारित शिकायतें"],
  ["fieldReceived", "Field Tasks Received", "प्राप्त क्षेत्रीय कार्य"],
  ["fieldCompleted", "Field Tasks Completed", "पूर्ण क्षेत्रीय कार्य"],
] as const;
const blank = (date: string, id: number): EntryInput => ({
  serviceDate: date,
  serviceId: id,
  ward: "",
  received: NaN,
  completed: NaN,
  slaWithinTime: NaN,
  amountPaise: 0,
  complaintsReceived: NaN,
  complaintsResolved: NaN,
  fieldReceived: NaN,
  fieldCompleted: NaN,
  avgDisposalDays: null,
  remarks: "",
});
type Payload = {
  setup: Setup | null;
  entries: EntryView[];
  openings: { serviceId: number; opening: Balances }[];
};
export default function DailyEntry({ officeId }: { officeId: number }) {
  const lang = useContext(Language),
    t = useText();
  const intent = useRef<MutationIntent | null>(null);
  const [date, setDate] = useState(todayIST()),
    [selected, setSelected] = useState(1),
    [data, setData] = useState<Payload | null>(null),
    [editingSetup, setEditingSetup] = useState(false),
    [input, setInput] = useState<EntryInput>(blank(date, selected)),
    [money, setMoney] = useState("0.00"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  async function load() {
    setError("");
    try {
      const p = await api<Payload>("/office/entries?date=" + date);
      setData(p);
      return p;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    api<Payload>("/office/entries?date=" + date)
      .then((p) => {
        if (active) setData(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [date]);
  const saved = data?.entries.find((e) => e.serviceId === selected);
  const opening = saved?.opening ??
    data?.openings.find((b) => b.serviceId === selected)?.opening ?? {
      service: 0,
      complaints: 0,
      field: 0,
    };
  useEffect(() => {
    setInput(saved ?? blank(date, selected));
    setMoney(saved ? (saved.amountPaise / 100).toFixed(2) : "");
    setReason("");
    setFields({});
    setDirty(false);
  }, [saved, date, selected]);
  function patch(key: string, value: unknown) {
    setDirty(true);
    setInput((p) => ({ ...p, [key]: value }));
    setMessage("");
  }
  function switchSelection(fn: () => void) {
    if (
      !dirty ||
      window.confirm(t("Discard unsaved changes?", "असहेजे परिवर्तन छोड़ें?"))
    )
      fn();
  }
  if (!data)
    return (
      <section className="panel">
        <p>
          {error ||
            t("Loading office report…", "कार्यालय रिपोर्ट लोड हो रही है…")}
        </p>
        {error && (
          <button onClick={() => void load()}>
            {t("Retry", "पुनः प्रयास")}
          </button>
        )}
      </section>
    );
  if (!data.setup || editingSetup)
    return (
      <InitialBalances
        existing={data.setup}
        onSaved={() => {
          setEditingSetup(false);
          void load();
        }}
        onCancel={data.setup ? () => setEditingSetup(false) : undefined}
      />
    );
  const close = applyActivity(opening, input);
  const service = services.find((s) => s.id === selected)!;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t("ANCHAL", "अंचल")} {officeId} /{" "}
            {t("DAILY REPORTING", "दैनिक रिपोर्टिंग")}
          </div>
          <h1>{t("Daily service entry", "दैनिक सेवा प्रविष्टि")}</h1>
          <p>
            {t(
              "One entry per service. Every submission updates the commissioner dashboard.",
              "प्रत्येक सेवा की एक प्रविष्टि। हर जमा रिपोर्ट से आयुक्त डैशबोर्ड अपडेट होता है।",
            )}
          </p>
        </div>
        <button onClick={() => switchSelection(() => setEditingSetup(true))}>
          {t("Opening balances", "प्रारंभिक शेष")}
        </button>
      </div>
      <div className="report-toolbar panel">
        <label>
          {t("View service date", "सेवा तिथि देखें")}
          <input
            type="date"
            value={date}
            max={todayIST()}
            min={data.setup.startDate}
            onChange={(e) =>
              switchSelection(() => {
                setDate(e.target.value);
                setData(null);
              })
            }
          />
        </label>
        <div className="report-progress">
          <strong>
            {data.entries.length}
            <span> / 25</span>
          </strong>
          <div>{t("services submitted", "सेवाएँ जमा")}</div>
          <progress value={data.entries.length} max={25} />
        </div>
        <p className="small">
          {t(
            "Zero activity must be submitted explicitly. Missing entries remain unreported.",
            "शून्य गतिविधि भी जमा करनी होगी। अनुपस्थित प्रविष्टियाँ अप्रतिवेदित रहेंगी।",
          )}
        </p>
      </div>
      <div className="entry-layout">
        <aside className="panel service-list">
          <div className="list-header">
            {t("SERVICE REGISTER", "सेवा सूची")} <span>25</span>
          </div>
          {services.map((s) => (
            <button
              key={s.id}
              className={selected === s.id ? "selected" : ""}
              onClick={() =>
                switchSelection(() => {
                  setSelected(s.id);
                  setMessage("");
                  setError("");
                })
              }
            >
              <span className="service-number">
                {String(s.id).padStart(2, "0")}
              </span>
              <span>{lang === "hi" ? s.name : s.en}</span>
              <span
                className="service-status"
                aria-label={
                  data.entries.some((e) => e.serviceId === s.id)
                    ? "Submitted"
                    : "Not submitted"
                }
              >
                {data.entries.some((e) => e.serviceId === s.id) ? "✓" : "○"}
              </span>
            </button>
          ))}
        </aside>
        <section className="panel entry-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                {t("SERVICE", "सेवा")} {String(selected).padStart(2, "0")} ·{" "}
                {service.category}
              </div>
              <h2>{lang === "hi" ? service.name : service.en}</h2>
              <p className="small">
                {lang === "hi" ? service.en : service.name}
              </p>
            </div>
            <span className="status-tag">
              {saved ? t("Submitted", "जमा") : t("Not submitted", "जमा नहीं")}
            </span>
          </div>
          <div className="balance-strip">
            {(["service", "complaints", "field"] as const).map((k, i) => (
              <div key={k}>
                <span>
                  {t(
                    [
                      "Opening pending",
                      "Opening complaints",
                      "Opening field tasks",
                    ][i],
                    [
                      "प्रारंभिक लंबित",
                      "प्रारंभिक शिकायतें",
                      "प्रारंभिक क्षेत्रीय कार्य",
                    ][i],
                  )}
                </span>
                <strong>{opening[k]}</strong>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setFields({});
              try {
                const command = {
                  expectedVersion: saved?.version ?? null,
                  input: { ...input, amountPaise: parseMoney(money) },
                  reason: saved ? reason : null,
                };
                intent.current = mutationIntent(intent.current, {
                  id: saved?.id,
                  command,
                });
                const payload = {
                  ...command,
                  requestId: intent.current.requestId,
                };
                await api(
                  saved ? "/office/entries/" + saved.id : "/office/entries",
                  saved ? "PUT" : "POST",
                  payload,
                );
                setDirty(false);
                await load();
                setMessage(
                  t(
                    "Entry saved. Dashboard updated.",
                    "प्रविष्टि सहेजी गई। डैशबोर्ड अपडेट हुआ।",
                  ),
                );
              } catch (e) {
                setError((e as Error).message);
                if (e instanceof RequestError)
                  setFields(e.detail.fieldErrors ?? {});
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label>
                {t("Service date", "सेवा तिथि")}
                <input
                  type="date"
                  required
                  aria-label={t("Service date", "सेवा तिथि")}
                  value={input.serviceDate}
                  max={todayIST()}
                  min={data.setup.startDate}
                  onChange={(e) =>
                    switchSelection(() => {
                      setDate(e.target.value);
                      setData(null);
                    })
                  }
                />
                <small>
                  {t(
                    "Select the day this service activity relates to.",
                    "इस सेवा गतिविधि की तिथि चुनें।",
                  )}
                </small>
              </label>
              <label>
                {t(
                  "Reporting / registration date",
                  "रिपोर्टिंग / पंजीकरण तिथि",
                )}
                <input
                  type="date"
                  readOnly
                  aria-label={t(
                    "Reporting / registration date",
                    "रिपोर्टिंग / पंजीकरण तिथि",
                  )}
                  value={saved?.reportingDate ?? todayIST()}
                />
                <small>
                  {saved
                    ? t("Registered at: ", "पंजीकरण समय: ") +
                      new Date(saved.createdAt).toLocaleString(
                        lang === "hi" ? "hi-IN" : "en-IN",
                        { timeZone: "Asia/Kolkata" },
                      )
                    : t(
                        "Recorded automatically on first submission.",
                        "प्रथम जमा पर स्वतः दर्ज होगी।",
                      )}
                </small>
              </label>
              <label className="wide">
                {t("Ward number / name", "वार्ड संख्या / नाम")}
                <input
                  required
                  maxLength={200}
                  value={input.ward}
                  onChange={(e) => patch("ward", e.target.value)}
                />
                {fields.ward && (
                  <span className="field-error">
                    {runtimeText(fields.ward, lang)}
                  </span>
                )}
              </label>
              {numeric.map(([k, en, hi]) => (
                <label key={k}>
                  {t(en, hi)}
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    required
                    step="1"
                    value={Number.isNaN(input[k]) ? "" : input[k]}
                    onChange={(e) =>
                      patch(
                        k,
                        e.target.value === "" ? NaN : Number(e.target.value),
                      )
                    }
                  />
                  {fields[k] && (
                    <span className="field-error">
                      {runtimeText(fields[k], lang)}
                    </span>
                  )}
                </label>
              ))}
              <label>
                {t("Amount Collected (₹)", "संग्रहित राशि (₹)")}
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={money}
                  onChange={(e) => {
                    setMoney(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                {t("Avg Disposal Days", "औसत निस्तारण दिन")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={input.completed > 0}
                  value={input.avgDisposalDays ?? ""}
                  onChange={(e) =>
                    patch(
                      "avgDisposalDays",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
                {fields.avgDisposalDays && (
                  <span className="field-error">
                    {runtimeText(fields.avgDisposalDays, lang)}
                  </span>
                )}
              </label>
              <label className="wide">
                {t("Remarks", "टिप्पणियाँ")}
                <textarea
                  maxLength={2000}
                  value={input.remarks}
                  onChange={(e) => patch("remarks", e.target.value)}
                />
              </label>
              {saved && (
                <label className="wide">
                  {t("Correction reason", "सुधार का कारण")}
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="closing-strip">
              <span>{t("Closing balances", "अंतिम शेष")}</span>
              <strong>
                {t("Work", "कार्य")}:{" "}
                {Number.isFinite(close.service) ? close.service : "—"}
              </strong>
              <strong>
                {t("Complaints", "शिकायतें")}:{" "}
                {Number.isFinite(close.complaints) ? close.complaints : "—"}
              </strong>
              <strong>
                {t("Field", "क्षेत्रीय")}:{" "}
                {Number.isFinite(close.field) ? close.field : "—"}
              </strong>
            </div>
            {error && (
              <div className="message" role="alert">
                {runtimeText(error, lang)}
                <button
                  type="button"
                  onClick={() => {
                    setDirty(false);
                    void load();
                  }}
                >
                  {t("Reload latest entry", "नवीनतम प्रविष्टि लोड करें")}
                </button>
              </div>
            )}
            {message && (
              <p className="message" role="status">
                ✓ {message}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setInput((p) => ({
                    ...blank(date, selected),
                    received: 0,
                    completed: 0,
                    slaWithinTime: 0,
                    complaintsReceived: 0,
                    complaintsResolved: 0,
                    fieldReceived: 0,
                    fieldCompleted: 0,
                    ward: p.ward,
                    remarks: p.remarks,
                  }));
                  setMoney("0.00");
                  setDirty(true);
                }}
              >
                {t("Set zero activity", "शून्य गतिविधि भरें")}
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? t("Saving…", "सहेजा जा रहा है…")
                  : saved
                    ? t("Save correction →", "सुधार सहेजें →")
                    : t("Submit entry →", "प्रविष्टि जमा करें →")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
