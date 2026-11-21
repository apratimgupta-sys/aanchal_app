import {
  Badge,
  Button,
  Field,
  FieldError,
  Input,
  Notice,
  Panel,
  ReportProgress,
  Select,
  focusRing,
  leadingBody,
  leadingHeading,
  leadingHelp,
} from "../ui";
import { cn } from "../lib/utils";
import { useContext, useEffect, useState, useRef } from "react";
import { z } from "zod";
import { toast } from "sonner";
import type {
  Balances,
  EntryInput,
  EntryView,
  Setup,
} from "../../shared/types";
import services from "../../shared/services.json";
import { todayIST, parseMoney, applyActivity } from "../../domain/ledger";
import { api, RequestError } from "../api";
import { normalizeFieldErrors } from "../field-errors";
import { auditFields } from "../audit";
import { Language, useText, runtimeText } from "../i18n";
import { mutationIntent, type MutationIntent } from "../mutation";
import { formatIndiaDateTime } from "../lib/dates";
import {
  entryCrossFieldErrors,
  isCanonicalWard,
  WARD_MESSAGE,
  type EntryCounts,
} from "../../domain/entry-rules";
import { WARD_MAX, WARD_MIN } from "../../domain/visit";
import { collects, formShape } from "../../domain/service-kind";
const COUNT_KEYS = [
  "received",
  "completed",
  "slaWithinTime",
  "complaintsReceived",
  "complaintsResolved",
  "fieldReceived",
  "fieldCompleted",
] as const;
type CountKey = (typeof COUNT_KEYS)[number];
// Work done is the `completed` field for the eight field-work services. The
// label is kept by hand because five of the eight do not match their unit word
// in the Service Master, and service 10 was settled with the client as
// "Animals picked up" — "Routes" reads wrong for dog control.
const WORK_DONE_LABEL: Record<number, readonly [string, string]> = {
  8: ["Trips", "फेरे"],
  9: ["Routes", "मार्ग"],
  10: ["Animals picked up", "पकड़े गए पशु"],
  13: ["Repairs", "मरम्मत"],
  14: ["Works", "कार्य"],
  15: ["Sites", "स्थल"],
  16: ["Sites", "स्थल"],
  17: ["Routes", "मार्ग"],
};
type NumericField = { key: CountKey; en: string; hi: string };
// The questions a service is actually asked. Everything else in the record is
// hidden, and a hidden count is sent as 0 rather than asked for.
function numericFields(serviceId: number): NumericField[] {
  switch (formShape(serviceId)) {
    case "revenue":
      // Payments is the existing `received` field relabelled; a payment
      // completes nothing, so there is no disposal figure.
      return [{ key: "received", en: "Payments", hi: "भुगतान" }];
    case "fieldwork": {
      const [en, hi] = WORK_DONE_LABEL[serviceId] ?? [
        "Work done",
        "किया गया कार्य",
      ];
      return [{ key: "completed", en, hi }];
    }
    default:
      return [
        { key: "received", en: "Received", hi: "प्राप्त" },
        { key: "completed", en: "Disposed", hi: "निस्तारित" },
      ];
  }
}
// The count keys this service's form renders — the only keys that have a Field
// to show a message in. Used for the schema, for seeding, and for catching a
// server error that has nowhere to land.
const shownKeys = (serviceId: number) =>
  new Set<string>(numericFields(serviceId).map((f) => f.key));
// Picked out one field at a time with an explicit default, rather than cast:
// the shape's hidden counts reach the cross-field rules as numbers or not at
// all, and `undefined > 1` would quietly answer false and skip a rule.
const countsOf = (value: Record<string, unknown>): EntryCounts => {
  const count = (k: CountKey) =>
    typeof value[k] === "number" ? (value[k] as number) : 0;
  return {
    received: count("received"),
    completed: count("completed"),
    slaWithinTime: count("slaWithinTime"),
    complaintsReceived: count("complaintsReceived"),
    complaintsResolved: count("complaintsResolved"),
    fieldReceived: count("fieldReceived"),
    fieldCompleted: count("fieldCompleted"),
  };
};
// Same format as the server; the picker's options are generated from the range.
export const wardSchema = z.string().refine(isCanonicalWard, WARD_MESSAGE);
const WARDS = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => `Ward ${WARD_MIN + i}`);
const countField = z.number().int().min(0);
// Loose, so the fields the shape hides pass through to the cross-field check
// below instead of being stripped before it runs.
const baseEntrySchema = z.looseObject({
  ward: wardSchema,
  // Unrendered on purpose: correcting an entry filed before the cutover must keep its saved value. Do not remove.
  avgDisposalDays: z.number().min(0).nullable(),
  remarks: z.string().max(2000),
});
// Built per shape. Requiring a field the shape hides would fail on it with
// nowhere to show the message — the error span renders inside a Field that no
// longer exists — so the office would see "Please correct the highlighted
// fields" with nothing highlighted and no way to save.
const SHAPE_SCHEMAS = {
  counter: baseEntrySchema.extend({
    received: countField,
    completed: countField,
  }),
  revenue: baseEntrySchema.extend({ received: countField }),
  fieldwork: baseEntrySchema.extend({ completed: countField }),
};
// The cross-field rules depend on what kind of work the service is, so the
// schema is built per service rather than shared.
const schemaForService = (serviceId: number) => {
  const shown = shownKeys(serviceId);
  return SHAPE_SCHEMAS[formShape(serviceId)].superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(
      entryCrossFieldErrors(serviceId, countsOf(value)),
    ))
      // A rule on a hidden field cannot be acted on and must not block a save.
      if (shown.has(path)) ctx.addIssue({ code: "custom", path: [path], message });
  });
};
const blank = (date: string, id: number): EntryInput => {
  const shown = shownKeys(id);
  // A shown count starts NaN so the input renders empty rather than "0". A
  // hidden one must start 0: NaN serializes to JSON null, the API reads the
  // body with JsonNumberHandling.Strict, and null into a long is a 422.
  const seed = (k: CountKey) => (shown.has(k) ? NaN : 0);
  return {
    serviceDate: date,
    serviceId: id,
    ward: "",
    received: seed("received"),
    completed: seed("completed"),
    slaWithinTime: seed("slaWithinTime"),
    amountPaise: 0,
    complaintsReceived: seed("complaintsReceived"),
    complaintsResolved: seed("complaintsResolved"),
    fieldReceived: seed("fieldReceived"),
    fieldCompleted: seed("fieldCompleted"),
    // Unrendered on purpose: correcting an entry filed before the cutover must keep its saved value. Do not remove.
    avgDisposalDays: null,
    remarks: "",
    nothingToReport: false,
  };
};
type Payload = {
  setup: Setup | null;
  entries: EntryView[];
  openings: { serviceId: number; opening: Balances }[];
};
// Hindi leading rides on the leading constants, so nothing here depends on the
// element-level line-height rule that styles.css still carries.
// `eyebrow` is also a bare hook: tests read the panel's own eyebrow through it.
const eyebrow = `eyebrow text-[11px] font-medium uppercase tracking-[0.05em] [html[lang=hi]_&]:tracking-normal ${leadingBody} text-muted-foreground`;
const pageHeading = `text-[23px] font-semibold ${leadingHeading} text-foreground`;
// A readout sits on the same 44px control line as the inputs beside it, so it
// aligns with them by height rather than by tuned padding.
const readout = `flex min-h-[44px] min-w-[72px] items-center justify-end font-mono text-[16px] tabular-nums lg:text-[13.5px] ${leadingBody} text-foreground`;
const shapeLabel = {
  counter: ["Counter work", "काउंटर कार्य"],
  revenue: ["Collections", "संग्रह"],
  fieldwork: ["Field work", "क्षेत्रीय कार्य"],
} as const;
function yesterdayIST() {
  const d = new Date(`${todayIST()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export default function DailyEntry({
  officeId,
  mode,
  startDate,
  onDirtyChange,
  preserveDraftSignal,
  onContinueDraftInBackdate,
}: {
  officeId: number;
  mode: "today" | "backdate";
  startDate: string;
  onDirtyChange: (dirty: boolean) => void;
  preserveDraftSignal: number;
  onContinueDraftInBackdate: () => void;
}) {
  const lang = useContext(Language),
    t = useText();
  const intent = useRef<MutationIntent | null>(null);
  const [currentToday, setCurrentToday] = useState(todayIST);
  const today = currentToday;
  const latestBackdate = yesterdayIST();
  const backdateAvailable = startDate <= latestBackdate;
  const [date, setDate] = useState(
      mode === "today" ? today : backdateAvailable ? latestBackdate : startDate,
    ),
    [selected, setSelected] = useState(1),
    [data, setData] = useState<Payload | null>(null),
    [editingEntry, setEditingEntry] = useState(false),
    [input, setInput] = useState<EntryInput>(blank(date, selected)),
    [money, setMoney] = useState("0.00"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [canReload, setCanReload] = useState(false),
    [fields, setFields] = useState<Record<string, string>>({}),
    // Server field errors with no Field of their own to render in.
    [unhandled, setUnhandled] = useState<[string, string][]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const previousMode = useRef(mode);
  const consumedPreserveSignal = useRef(preserveDraftSignal);
  const dayChanged = mode === "today" && date < today;
  useEffect(() => {
    const refreshDay = () => setCurrentToday(todayIST());
    const timer = window.setInterval(refreshDay, 15000);
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDay);
      document.removeEventListener("visibilitychange", refreshDay);
    };
  }, []);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const preserveDraft = preserveDraftSignal > consumedPreserveSignal.current;
    consumedPreserveSignal.current = preserveDraftSignal;
    if (preserveDraft) return;
    setDate(
      mode === "today"
        ? today
        : startDate <= latestBackdate
          ? latestBackdate
          : startDate,
    );
    setData(null);
    setDirty(false);
    onDirtyChange(false);
  }, [mode]);
  useEffect(() => {
    if (mode === "today" && date < today && !dirty) {
      setDate(today);
      setData(null);
    }
  }, [today, mode, date, dirty]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  async function load() {
    setError("");
    try {
      const p = await api<Payload>(`/office/entries?date=${date}&mode=${mode}`);
      setData(p);
      return p;
    } catch (e) {
      setError((e as Error).message);
      setCanReload(true);
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    if (mode === "backdate" && !backdateAvailable) {
      setData(null);
      setError("");
      return () => {
        active = false;
      };
    }
    api<Payload>(`/office/entries?date=${date}&mode=${mode}`)
      .then((p) => {
        if (active) setData(p);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setCanReload(true);
        }
      });
    return () => {
      active = false;
    };
  }, [date, mode]);
  const saved = data?.entries.find((e) => e.serviceId === selected);
  // Everything the entry panel shows, validates and submits is keyed to the
  // draft's own service rather than to the selection. The two are kept in step
  // by switchSelection above; keying the panel here as well means that even if
  // they ever drifted, the office could not read one service's name over
  // another service's boxes and file the second.
  const formServiceId = input.serviceId;
  const opening = saved?.opening ??
    data?.openings.find((b) => b.serviceId === formServiceId)?.opening ?? {
      service: 0,
      complaints: 0,
      field: 0,
    };
  useEffect(() => {
    if (dirty) return;
    setInput(saved ?? blank(date, selected));
    setMoney(saved ? (saved.amountPaise / 100).toFixed(2) : "");
    setReason("");
    setFields({});
    setUnhandled([]);
    setDirty(false);
    setEditingEntry(false);
  }, [saved, date, selected, dirty]);
  function patch(key: string, value: unknown) {
    setDirty(true);
    // Typing a figure means there is something to report after all.
    const isFigure = (COUNT_KEYS as readonly string[]).includes(key);
    setInput((p) => ({ ...p, [key]: value, ...(isFigure ? { nothingToReport: false } : {}) }));
    setMessage("");
  }
  function switchSelection(fn: () => void) {
    if (!dirty) {
      fn();
      return;
    }
    if (!window.confirm(t("Discard unsaved changes?", "असहेजे परिवर्तन छोड़ें?")))
      return;
    // The draft has to go with the selection. While `dirty` stays true the
    // effect below that re-seeds the form for the newly selected service bails
    // out, so the panel would describe one service while `input` still held
    // another's figures — and its serviceId, which is what gets filed.
    setDirty(false);
    onDirtyChange(false);
    fn();
  }
  if (mode === "backdate" && !backdateAvailable)
    return (
      <Panel className="grid gap-3">
        <h1 className={pageHeading}>
          {t("Backdate Entry", "पिछली तिथि की प्रविष्टि")}
        </h1>
        <p className={`text-[13.5px] ${leadingBody}`}>
          {t(
            "Backdated entry becomes available the day after the reporting start date.",
            "रिपोर्टिंग प्रारंभ तिथि के अगले दिन से पिछली तिथि की प्रविष्टि उपलब्ध होगी।",
          )}
        </p>
      </Panel>
    );
  if (!data)
    return (
      <Panel className="grid justify-items-start gap-3">
        <p className={`text-[13.5px] ${leadingBody}`}>
          {error ||
            t("Loading office report…", "कार्यालय रिपोर्ट लोड हो रही है…")}
        </p>
        {error && (
          <Button variant="outline" onClick={() => void load()}>
            {t("Retry", "पुनः प्रयास")}
          </Button>
        )}
      </Panel>
    );
  const close = applyActivity(opening, input);
  const service = services.find((s) => s.id === formServiceId)!;
  const shape = formShape(formServiceId);
  const shownFields = numericFields(formServiceId);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <div className={eyebrow}>
          {t("ANCHAL", "अंचल")} {officeId} /{" "}
          {t("DAILY REPORTING", "दैनिक रिपोर्टिंग")}
        </div>
        <h1 className={pageHeading}>
          {t("Daily service entry", "दैनिक सेवा प्रविष्टि")}
        </h1>
      </div>
      {dayChanged && (
        <Notice className="grid gap-3">
          <p>
            {t(
              "The IST reporting day has changed. This draft still belongs to the previous service date.",
              "IST रिपोर्टिंग दिवस बदल गया है। यह प्रारूप पिछली सेवा तिथि का है।",
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            {date >= startDate && (
              <Button
                variant="outline"
                type="button"
                onClick={onContinueDraftInBackdate}
              >
                {t(
                  "Continue draft in Backdate Entry",
                  "पिछली तिथि की प्रविष्टि में प्रारूप जारी रखें",
                )}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setDirty(false);
                onDirtyChange(false);
                setDate(today);
                setData(null);
                setInput(blank(today, selected));
                setMoney("");
                setReason("");
                setEditingEntry(false);
              }}
            >
              {t("Discard draft and start today", "प्रारूप छोड़कर आज शुरू करें")}
            </Button>
          </div>
        </Notice>
      )}
      <Panel className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4 sm:py-4">
        <div className="flex items-baseline gap-2">
          <strong className={`text-[18px] font-semibold ${leadingHeading}`}>
            {data.entries.length}
            <span className={`font-normal ${leadingBody} text-muted-foreground`}> / 25</span>
          </strong>
          <div className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
            {t("services submitted", "सेवाएँ जमा")}
          </div>
        </div>
        <div className="min-w-[12rem] flex-1">
          <ReportProgress value={data.entries.length} max={25} />
        </div>
      </Panel>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <Panel className="flex flex-col overflow-hidden p-0 sm:p-0 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)]">
          <div className={`flex justify-between border-b border-border bg-muted px-4 py-3 ${eyebrow}`}>
            {t("SERVICE REGISTER", "सेवा सूची")} <span>25</span>
          </div>
          <ul
            className="m-0 grid max-h-[15rem] list-none gap-0.5 overflow-y-auto p-2 lg:max-h-none lg:flex-1"
            aria-label={t("Municipal services", "नगर निगम सेवाएँ")}
          >
            {services.map((s) => (
              <li key={s.id}>
                <button
                  key={s.id}
                  className={cn(
                    `grid min-h-[44px] w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] ${leadingBody} text-foreground hover:bg-muted`,
                    "aria-[current=true]:bg-accent aria-[current=true]:font-semibold aria-[current=true]:text-accent-foreground",
                    focusRing,
                  )}
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
                  <span className={`font-mono text-xs ${leadingHelp} tabular-nums text-muted-foreground`}>
                    {String(s.id).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{lang === "hi" ? s.name : s.en}</span>
                  <span
                    role="img"
                    className={cn(
                      `text-center text-base ${leadingBody}`,
                      data.entries.some((e) => e.serviceId === s.id)
                        ? "text-success"
                        : "text-muted-foreground",
                    )}
                    aria-label={
                      data.entries.some((e) => e.serviceId === s.id)
                        ? "Submitted"
                        : "Not submitted"
                    }
                  >
                    {data.entries.some((e) => e.serviceId === s.id) ? "✓" : "•"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {/* `entry-panel` carries no style: tests find the panel's own fields by it. */}
        <Panel className="entry-panel grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
            <div className="min-w-0">
              <div className={eyebrow}>
                {t("SERVICE", "सेवा")} {String(formServiceId).padStart(2, "0")} ·{" "}
                {service.category}
              </div>
              <h2 className={`text-[17px] font-semibold ${leadingHeading} text-foreground`}>
                {lang === "hi" ? service.name : service.en}
              </h2>
              <p className={`text-xs ${leadingHelp} text-muted-foreground`}>
                {lang === "hi" ? service.en : service.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{t(shapeLabel[shape][0], shapeLabel[shape][1])}</Badge>
              <Badge tone={saved ? "settled" : "neutral"}>
                {saved ? t("Submitted", "जमा") : t("Not submitted", "जमा नहीं")}
              </Badge>
            </div>
          </div>
          {/* Only counter work has a queue, so only the counter shape has a
              balance to open against. */}
          {shape === "counter" && (
            <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[7px] bg-muted px-4 py-3 text-[13.5px] ${leadingBody}`}>
              <span className="text-muted-foreground">{t("Opening pending", "प्रारंभिक लंबित")}</span>
              <strong className="font-mono font-semibold tabular-nums">{opening.service}</strong>
            </div>
          )}
          {mode === "backdate" && (
            <Field className="sm:max-w-[15rem]">
              {t("Service date", "सेवा तिथि")}
              <input
                type="date"
                aria-label={t("Service date", "सेवा तिथि")}
                min={startDate}
                max={latestBackdate}
                value={input.serviceDate}
                onChange={(e) =>
                  switchSelection(() => {
                    setDate(e.target.value);
                    setData(null);
                  })
                }
              />
              <span>
                {t(
                  "Select the day this service activity relates to.",
                  "इस सेवा गतिविधि की तिथि चुनें।",
                )}
              </span>
            </Field>
          )}
          <form
            className="grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saved && !editingEntry) return;
              const liveToday = todayIST();
              if (mode === "today" && input.serviceDate !== liveToday) {
                setCurrentToday(liveToday);
                return;
              }
              setBusy(true);
              setError("");
              setCanReload(false);
              setFields({});
              setUnhandled([]);
              try {
                const checked = schemaForService(input.serviceId).safeParse(input);
                if (!checked.success) {
                  const shown = shownKeys(input.serviceId);
                  const hasAField = (key: string) =>
                    key === "ward" || shown.has(key);
                  const nextFields: Record<string, string> = {};
                  // An issue on a key with no Field of its own would otherwise
                  // leave the office reading "correct the highlighted fields"
                  // with nothing highlighted and no way to save, which is what
                  // the server-error path below already guards against.
                  const noField: [string, string][] = [];
                  const seen = new Set<string>();
                  checked.error.issues.forEach((issue) => {
                    const key = String(issue.path[0]);
                    if (seen.has(key)) return;
                    seen.add(key);
                    if (hasAField(key)) nextFields[key] = issue.message;
                    else noField.push([key, issue.message]);
                  });
                  setFields(nextFields);
                  setUnhandled(noField);
                  setError(t("Please correct the highlighted fields.", "कृपया चिह्नित फ़ील्ड ठीक करें।"));
                  return;
                }
                const command = {
                  expectedVersion: saved?.version ?? null,
                  mode,
                  input: {
                    ...input,
                    // Only the revenue shape has a money input. Everywhere else
                    // the figure comes from the record: 0 on a new entry, and
                    // whatever was stored on a correction.
                    amountPaise:
                      shape === "revenue" ? parseMoney(money) : input.amountPaise,
                  },
                  reason: saved ? reason : mode === "backdate" ? reason : null,
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
                toast.success(t("Entry saved", "प्रविष्टि सहेजी गई"));
              } catch (e) {
                setError((e as Error).message);
                setCanReload(
                  e instanceof RequestError
                    ? Object.keys(e.detail.fieldErrors ?? {}).length === 0
                    : e instanceof TypeError,
                );
                toast.error(t("Could not save entry", "प्रविष्टि सहेजी नहीं जा सकी"));
                if (e instanceof RequestError) {
                  const returned = normalizeFieldErrors(e.detail.fieldErrors);
                  const shown = shownKeys(input.serviceId);
                  const hasAField = (key: string) =>
                    key === "ward" || shown.has(key);
                  setFields(
                    Object.fromEntries(
                      Object.entries(returned).filter(([k]) => hasAField(k)),
                    ),
                  );
                  // A key with nowhere to highlight would otherwise leave the
                  // office reading "correct the highlighted fields" with
                  // nothing highlighted, so say what was objected to.
                  setUnhandled(
                    Object.entries(returned).filter(([k]) => !hasAField(k)),
                  );
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid gap-5">
              <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-2">
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
                  <span>
                    {saved
                      ? t("Registered at: ", "पंजीकरण समय: ") +
                        formatIndiaDateTime(saved.createdAt, "dd/MM/yyyy HH:mm")
                      : t(
                          "Recorded automatically on first submission.",
                          "प्रथम जमा पर स्वतः दर्ज होगी।",
                        )}
                  </span>
                </Field>
                <Field>
                  {t("Ward", "वार्ड")}
                  <Select
                    disabled={!!saved && !editingEntry}
                    required
                    value={input.ward}
                    onChange={(e) => patch("ward", e.target.value)}
                  >
                    <option value="">{t("Select a ward", "वार्ड चुनें")}</option>
                    {WARDS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </Select>
                  {fields.ward && (
                    <FieldError>{runtimeText(fields.ward, lang)}</FieldError>
                  )}
                </Field>
              </div>
              {/* The figures this shape collects, sized to their content, with the
                  closing balance on the same control line where one exists. */}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-4">
                {shownFields.map(({ key: k, en, hi }) => (
                  <Field key={k} className="max-w-[18rem]">
                    {t(en, hi)}
                    <Input
                      width="count"
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
                      <FieldError>{runtimeText(fields[k], lang)}</FieldError>
                    )}
                  </Field>
                ))}
                {/* Money is collected by the three revenue services and nobody
                    else: grass cutting takes no payments. */}
                {shape === "revenue" && (
                  <Field className="max-w-[18rem]">
                    {t("Amount Collected (₹)", "संग्रहित राशि (₹)")}
                    <Input
                      width="money"
                      readOnly={!!saved && !editingEntry}
                      type="text"
                      inputMode="decimal"
                      required
                      value={money}
                      onChange={(e) => {
                        setMoney(e.target.value);
                        setInput((p) => ({ ...p, nothingToReport: false }));
                        setDirty(true);
                      }}
                    />
                  </Field>
                )}
                {/* Same treatment as the opening strip: a closing balance only
                    means something where work queues. */}
                {shape === "counter" && (
                  <div className="grid gap-1.5">
                    <span className={`text-[11px] font-medium ${leadingBody} text-muted-foreground`}>
                      {t("Closing pending", "अंतिम लंबित")}
                    </span>
                    <strong className={cn(readout, "font-semibold")}>
                      {Number.isFinite(close.service) ? close.service : "—"}
                    </strong>
                  </div>
                )}
              </div>
              <Field>
                {t("Remarks", "टिप्पणियाँ")}
                <textarea
                  readOnly={!!saved && !editingEntry}
                  maxLength={2000}
                  value={input.remarks}
                  onChange={(e) => patch("remarks", e.target.value)}
                />
              </Field>
              {((saved && editingEntry) || (!saved && mode === "backdate")) && (
                <Field>
                  {saved
                    ? t("Correction reason", "सुधार का कारण")
                    : t(
                        "Reason for delayed reporting",
                        "विलंबित रिपोर्टिंग का कारण",
                      )}
                  <textarea
                    name="reason"
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
            {error && (
              <Notice className="grid gap-3" role="alert">
                <p>{runtimeText(error, lang)}</p>
                {unhandled.length > 0 && (
                  <ul className="grid list-disc gap-1 pl-5">
                    {unhandled.map(([key, message]) => (
                      <li key={key}>
                        {t(
                          auditFields[key]?.[0] ?? key,
                          auditFields[key]?.[1] ?? key,
                        )}
                        : {runtimeText(message, lang)}
                      </li>
                    ))}
                  </ul>
                )}
                {canReload && (
                  <Button
                    variant="outline"
                    className="justify-self-start"
                    type="button"
                    onClick={() => {
                      setDirty(false);
                      void load();
                    }}
                  >
                    {t("Reload latest entry", "नवीनतम प्रविष्टि लोड करें")}
                  </Button>
                )}
              </Notice>
            )}
            {message && (
              <Notice role="status">
                ✓ {message}
              </Notice>
            )}
            {(!saved || editingEntry) && (
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    // Zero only what this shape asks for. Every other field is
                    // retired but may hold a figure already filed, and a
                    // correction must not erase it. Keyed to the draft's own
                    // service, like the rest of the panel, not the selection.
                    const shown = shownKeys(input.serviceId);
                    const money0 = collects(input.serviceId, "amountPaise");
                    setInput((p) => {
                      const next: EntryInput = { ...p, nothingToReport: true };
                      for (const k of COUNT_KEYS) if (shown.has(k)) next[k] = 0;
                      if (money0) next.amountPaise = 0;
                      return next;
                    });
                    if (money0) setMoney("0.00");
                    setDirty(true);
                  }}
                >
                  {t("Set zero activity", "शून्य गतिविधि भरें")}
                </Button>
                <Button disabled={busy || dayChanged}>
                  {busy
                    ? t("Saving…", "सहेजा जा रहा है…")
                    : saved
                      ? t("Save correction →", "सुधार सहेजें →")
                      : t("Submit entry →", "प्रविष्टि जमा करें →")}
                </Button>
              </div>
            )}
            {saved && !editingEntry && (
              <div className="flex">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingEntry(true);
                    setMessage("");
                  }}
                >
                  {t("Edit entry", "प्रविष्टि संपादित करें")}
                </Button>
              </div>
            )}
            {saved && editingEntry && (
              <Button
                variant="outline"
                type="button"
                className="justify-self-start"
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
              </Button>
            )}
          </form>
        </Panel>
      </div>
    </div>
  );
}
