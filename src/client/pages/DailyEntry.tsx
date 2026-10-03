import { Field, Panel, Notice, ReportProgress } from "../ui";
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
    [editingEntry, setEditingEntry] = useState(false),
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
    setEditingEntry(false);
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
      <Panel className="panel">
        <p>
          {error ||
            t("Loading office report…", "कार्यालय रिपोर्ट लोड हो रही है…")}
        </p>
        {error && (
          <button
            className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
            onClick={() => void load()}
          >
            {t("Retry", "पुनः प्रयास")}
          </button>
        )}
      </Panel>
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
      <div className="page-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
        <div>
          <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
            {t("ANCHAL", "अंचल")} {officeId} /{" "}
            {t("DAILY REPORTING", "दैनिक रिपोर्टिंग")}
          </div>
          <h1 className="ux4g-heading-xl-strong">
            {t("Daily service entry", "दैनिक सेवा प्रविष्टि")}
          </h1>
        </div>
        <button
          className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
          onClick={() => switchSelection(() => setEditingSetup(true))}
        >
          {t("Opening balances", "प्रारंभिक शेष")}
        </button>
      </div>
      <Panel className="report-toolbar panel">
        <div className="report-progress">
          <strong className="ux4g-heading-m-strong">
            {data.entries.length}
            <span> / 25</span>
          </strong>
          <div>{t("services submitted", "सेवाएँ जमा")}</div>
          <ReportProgress value={data.entries.length} max={25} />
        </div>
      </Panel>
      <div className="entry-layout">
        <Panel className="panel service-list">
          <div className="list-header ux4g-label-m-strong ux4g-p-m ux4g-bg-neutral-soft ux4g-d-flex ux4g-jc-between">
            {t("SERVICE REGISTER", "सेवा सूची")} <span>25</span>
          </div>
          <ul
            className="ux4g-list ux4g-list-default ux4g-list-m"
            aria-label={t("Municipal services", "नगर निगम सेवाएँ")}
          >
            {services.map((s) => (
              <li className="ux4g-list-item" key={s.id}>
                <button
                  key={s.id}
                  className={`ux4g-list-item-row ux4g-min-h-48 ${selected === s.id ? "ux4g-bg-primary-soft" : ""}`}
                  aria-current={selected === s.id ? "true" : undefined}
                  onClickCapture={(event) => {
                    // React owns selection and the draft guard. Intercept before
                    // UX4G's target listener can mutate its independent .active state.
                    event.stopPropagation();
                    switchSelection(() => {
                      setSelected(s.id);
                      setMessage("");
                      setError("");
                    });
                  }}
                >
                  <span className="service-number ux4g-label-m-default ux4g-text-neutral-secondary">
                    {String(s.id).padStart(2, "0")}
                  </span>
                  <span>{lang === "hi" ? s.name : s.en}</span>
                  <span
                    className="service-status ux4g-icon-outlined ux4g-text-neutral-secondary"
                    aria-label={
                      data.entries.some((e) => e.serviceId === s.id)
                        ? "Submitted"
                        : "Not submitted"
                    }
                  >
                    {data.entries.some((e) => e.serviceId === s.id)
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="panel entry-panel">
          <div className="section-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
            <div>
              <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
                {t("SERVICE", "सेवा")} {String(selected).padStart(2, "0")} ·{" "}
                {service.category}
              </div>
              <h2 className="ux4g-heading-m-strong">
                {lang === "hi" ? service.name : service.en}
              </h2>
              <p className="small ux4g-body-xs-default ux4g-text-neutral-secondary">
                {lang === "hi" ? service.en : service.name}
              </p>
            </div>
            <span className="status-tag ux4g-tag-tonal-neutral">
              {saved ? t("Submitted", "जमा") : t("Not submitted", "जमा नहीं")}
            </span>
          </div>
          <div className="balance-strip ux4g-bg-neutral-soft ux4g-p-m ux4g-radius-m ux4g-gap-m">
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
          <Field className="short-field">
            {t("Service date", "सेवा तिथि")}
            <input
              type="date"
              aria-label={t("Service date", "सेवा तिथि")}
              value={input.serviceDate}
              max={todayIST()}
              onChange={(e) =>
                switchSelection(() => {
                  setDate(e.target.value);
                  setData(null);
                })
              }
            />
            <small className="ux4g-d-block ux4g-mt-xs">
              {t(
                "Select the day this service activity relates to.",
                "इस सेवा गतिविधि की तिथि चुनें।",
              )}
            </small>
          </Field>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (saved && !editingEntry) return;
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
                setEditingEntry(false);
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
              <Field>
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
                <small className="ux4g-d-block ux4g-mt-xs">
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
              </Field>
              <Field className="wide">
                {t("Ward number / name", "वार्ड संख्या / नाम")}
                <input
                  readOnly={!!saved && !editingEntry}
                  required
                  maxLength={200}
                  value={input.ward}
                  onChange={(e) => patch("ward", e.target.value)}
                />
                {fields.ward && (
                  <span className="field-error ux4g-text-error">
                    {runtimeText(fields.ward, lang)}
                  </span>
                )}
              </Field>
              {numeric.map(([k, en, hi]) => (
                <Field key={k}>
                  {t(en, hi)}
                  <input
                    readOnly={!!saved && !editingEntry}
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
                    <span className="field-error ux4g-text-error">
                      {runtimeText(fields[k], lang)}
                    </span>
                  )}
                </Field>
              ))}
              <Field>
                {t("Amount Collected (₹)", "संग्रहित राशि (₹)")}
                <input
                  readOnly={!!saved && !editingEntry}
                  type="text"
                  inputMode="decimal"
                  required
                  value={money}
                  onChange={(e) => {
                    setMoney(e.target.value);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field>
                {t("Avg Disposal Days", "औसत निस्तारण दिन")}
                <input
                  readOnly={!!saved && !editingEntry}
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
                  <span className="field-error ux4g-text-error">
                    {runtimeText(fields.avgDisposalDays, lang)}
                  </span>
                )}
              </Field>
              <Field className="wide">
                {t("Remarks", "टिप्पणियाँ")}
                <textarea
                  readOnly={!!saved && !editingEntry}
                  maxLength={2000}
                  value={input.remarks}
                  onChange={(e) => patch("remarks", e.target.value)}
                />
              </Field>
              {saved && editingEntry && (
                <Field className="wide">
                  {t("Correction reason", "सुधार का कारण")}
                  <textarea
                    readOnly={!!saved && !editingEntry}
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setDirty(true);
                    }}
                  />
                </Field>
              )}
            </div>
            <div className="closing-strip ux4g-body-s-default ux4g-bg-neutral-soft ux4g-p-m ux4g-radius-m ux4g-d-flex ux4g-flex-wrap ux4g-ai-center ux4g-gap-x-l ux4g-mt-l">
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
              <Notice className="message" role="alert">
                {runtimeText(error, lang)}
                <button
                  className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
                  type="button"
                  onClick={() => {
                    setDirty(false);
                    void load();
                  }}
                >
                  {t("Reload latest entry", "नवीनतम प्रविष्टि लोड करें")}
                </button>
              </Notice>
            )}
            {message && (
              <Notice className="message" role="status">
                ✓ {message}
              </Notice>
            )}
            {(!saved || editingEntry) && (
              <div className="form-actions ux4g-d-flex ux4g-flex-wrap ux4g-jc-between ux4g-gap-x-l ux4g-mt-l">
                <button
                  className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
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
                <button
                  className="ux4g-btn ux4g-btn-l ux4g-btn-primary "
                  disabled={busy}
                >
                  {busy
                    ? t("Saving…", "सहेजा जा रहा है…")
                    : saved
                      ? t("Save correction →", "सुधार सहेजें →")
                      : t("Submit entry →", "प्रविष्टि जमा करें →")}
                </button>
              </div>
            )}
            {saved && !editingEntry && (
              <div className="form-actions ux4g-mt-l">
                <button
                  type="button"
                  className="ux4g-btn ux4g-btn-primary ux4g-btn-l"
                  onClick={() => {
                    setEditingEntry(true);
                    setMessage("");
                  }}
                >
                  {t("Edit entry", "प्रविष्टि संपादित करें")}
                </button>
              </div>
            )}
            {saved && editingEntry && (
              <button
                type="button"
                className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-l ux4g-mt-l"
                onClick={() => {
                  setInput(saved);
                  setMoney((saved.amountPaise / 100).toFixed(2));
                  setReason("");
                  setFields({});
                  setError("");
                  setDirty(false);
                  setEditingEntry(false);
                }}
              >
                {t("Cancel editing", "संपादन रद्द करें")}
              </button>
            )}
          </form>
        </Panel>
      </div>
    </>
  );
}
