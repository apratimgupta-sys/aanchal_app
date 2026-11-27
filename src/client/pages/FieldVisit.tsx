import { useId, useRef, useState, type FormEvent } from "react";
import { Camera, MapPin } from "lucide-react";
import services from "../../shared/services.json";
import bounds from "../../shared/field-visit-bounds.json";
import type { FieldVisitInput, GpsReading, OfficerProfile } from "../../shared/types";
import { validateVisitInput, WARD_MAX, WARD_MIN } from "../../domain/visit";
import { detailValue, fieldsFor, type VisitField } from "../../domain/field-visit-fields";
import { RequestError } from "../api";
import { createVisit } from "../field-visits";
import { normalizeFieldErrors } from "../field-errors";
import {
  GeolocationCaptureError,
  capturePosition,
  type GeolocationFailureKind,
} from "../lib/geolocation";
import { Language, runtimeText, useText } from "../i18n";
import { indiaTimeOfDay, indiaToday, visitTimeAt } from "../lib/dates";
import { cn } from "../lib/utils";
import { mapUrl } from "../components/VisitLocation";
import { Button, Field, FieldError, Notice, Panel, focusRing, leadingBody, leadingHeading, leadingHelp } from "../ui";
import { mutationIntent, type MutationIntent } from "../mutation";
import { useContext } from "react";

const ANCHALS = [1, 2, 3, 4, 5, 6];
const WARDS = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => WARD_MIN + i);

// What a field-work service calls the date of its visit and the description of what
// was found or done, kept by hand like the daily entry's WORK_DONE_LABEL. A service
// not listed (the counter services) keeps the plain pair. The date is always today
// and is shown, not asked for; the description is the required Issue / Action text.
const PLAIN_LABELS = {
  date: ["Visit date", "निरीक्षण की तिथि"],
  description: ["Issue / Action", "समस्या / कार्रवाई"],
} as const;
const VISIT_LABELS: Record<number, { date: readonly [string, string]; description: readonly [string, string] }> = {
  8: { date: ["Pickup date", "उठाव की तिथि"], description: ["Work description", "कार्य का विवरण"] },
  9: { date: ["Fogging date", "फॉगिंग तिथि"], description: ["Work description", "कार्य का विवरण"] },
  10: { date: ["Activity date", "गतिविधि तिथि"], description: ["Outcome description", "परिणाम का विवरण"] },
  13: { date: ["Date", "तिथि"], description: ["Fault & work description", "खराबी और कार्य का विवरण"] },
  14: { date: ["Inspection date", "निरीक्षण तिथि"], description: ["Inspection description", "निरीक्षण का विवरण"] },
  15: { date: ["Work date", "कार्य तिथि"], description: ["Work description", "कार्य का विवरण"] },
  16: { date: ["Work date", "कार्य तिथि"], description: ["Pruning description", "छंटाई का विवरण"] },
  17: { date: ["Date", "तिथि"], description: ["Work description", "कार्य का विवरण"] },
};
// Errors the form has a place for. A server message under any other key is listed
// at the top rather than lost: the envelope alone says "correct the highlighted
// fields" and a person must never be left with nothing highlighted.
const PLACED = new Set(["officeId", "ward", "serviceId", "visitTime", "issueAction", "gps", "visitDate"]);

export default function FieldVisit({
  officer,
  today,
  clock = () => new Date(),
}: {
  officer: OfficerProfile;
  today: string;
  clock?: () => Date;
}) {
  const text = useText();
  const locationId = useId();
  const dateId = useId();
  const lang = useContext(Language);
  const translate = (message: string) => runtimeText(message, lang);
  // The day the form files under. `today` is only where it starts: it is read once,
  // when the page opens, and a form opened at 23:52 and submitted at 00:03 would
  // otherwise be refused for its date on every retry. submit() reads the clock again.
  const [day, setDay] = useState(today);
  const [officeId, setOfficeId] = useState(officer.homeOfficeId);
  const [ward, setWard] = useState<number | "">("");
  const [serviceId, setServiceId] = useState<number | "">("");
  const [issueAction, setIssueAction] = useState("");
  // What was typed into the service's own fields, by key. It belongs to the service
  // on screen: changing the service empties it (see changeService).
  const [details, setDetails] = useState<Record<string, string>>({});
  // The time of visit follows the moment the location was captured until the officer
  // types one of their own; submit() settles it against the day it files on.
  const [visitTime, setVisitTime] = useState(() => indiaTimeOfDay(clock()));
  const [timeTyped, setTimeTyped] = useState(false);
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<GeolocationFailureKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Figures the officer typed that the server's answer did not carry back: the
  // visit exists, its details do not. See submit().
  const [unsaved, setUnsaved] = useState<{ key: string; label: string; shown: string }[]>([]);
  const [saving, setSaving] = useState(false);
  // Held in a ref, not state: two submits in the same flush must share one
  // request id, and a state update has not committed by then.
  const intentRef = useRef<MutationIntent | null>(null);
  const submittingRef = useRef(false);

  const captureMessages: Record<GeolocationFailureKind, string> = {
    denied: text(
      "Location permission is switched off for this site. Allow it in the browser and capture again.",
      "इस साइट के लिए स्थान की अनुमति बंद है। ब्राउज़र में अनुमति दें और पुनः कैप्चर करें।",
    ),
    unavailable: text(
      "The device could not fix a location here. Move into the open and capture again.",
      "उपकरण यहाँ स्थान नहीं पा सका। खुले में जाकर पुनः कैप्चर करें।",
    ),
    timeout: text(
      "Finding the location took too long. Capture again.",
      "स्थान खोजने में बहुत समय लगा। पुनः कैप्चर करें।",
    ),
    unsupported: text(
      "This browser cannot provide a location. Use a phone browser to record visits.",
      "यह ब्राउज़र स्थान नहीं दे सकता। निरीक्षण दर्ज करने के लिए फ़ोन ब्राउज़र का उपयोग करें।",
    ),
  };

  async function capture() {
    setCapturing(true);
    setCaptureError(null);
    try {
      const reading = await capturePosition();
      setGps(reading);
      if (!timeTyped) setVisitTime(visitTimeAt(reading.capturedAt, clock()));
    } catch (error) {
      // A failed re-capture leaves the earlier reading in place: a stale but
      // real fix is worth more than nothing.
      setCaptureError(
        error instanceof GeolocationCaptureError ? error.kind : "unavailable",
      );
    } finally {
      setCapturing(false);
    }
  }

  const serviceFields = serviceId === "" ? [] : fieldsFor(serviceId);
  const labels = (serviceId === "" ? undefined : VISIT_LABELS[serviceId]) ?? PLAIN_LABELS;

  // Switching service throws away what was typed for the last one: its keys are not
  // this service's, and a key both share (street) would otherwise carry the old
  // value into a filing against the new service.
  function changeService(value: number | "") {
    setServiceId(value);
    setDetails({});
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("details."))),
    );
  }

  function changeDetail(key: string, value: string) {
    setDetails((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(`details.${key}` in current)) return current;
      const { [`details.${key}`]: _gone, ...rest } = current;
      return rest;
    });
  }

  function detailsInput(): Record<string, string | number> | undefined {
    const out: Record<string, string | number> = {};
    for (const field of serviceFields) {
      const raw = (details[field.key] ?? "").trim();
      if (raw === "") continue;
      out[field.key] = detailValue(field, raw);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  function currentInput(visitDate: string, visitTime: string): FieldVisitInput {
    const filled = detailsInput();
    return {
      visitDate,
      visitTime,
      officeId,
      ward: ward === "" ? 0 : ward,
      serviceId: serviceId === "" ? 0 : serviceId,
      gps: gps ?? { latitude: Number.NaN, longitude: Number.NaN, accuracyMetres: Number.NaN, capturedAt: "" },
      issueAction,
      ...(filled ? { details: filled } : {}),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSaved(null);
    setUnsaved([]);
    if (submittingRef.current) return;
    const submitDay = indiaToday(clock());
    setDay(submitDay);
    // The date and the time are taken from the same moment. A time the officer typed is
    // theirs; any other is re-derived now, so a form opened before midnight does not
    // file the new day under the old day's time.
    const filedTime = timeTyped ? visitTime : visitTimeAt(gps?.capturedAt ?? "", clock());
    setVisitTime(filedTime);
    const input = currentInput(submitDay, filedTime);
    const found = validateVisitInput(input, submitDay);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const next = mutationIntent(intentRef.current, input);
    intentRef.current = next;
    submittingRef.current = true;
    setSaving(true);
    try {
      const stored = await createVisit(input, next.requestId);
      // A backend that predates the details column skips `input.details` without
      // complaint and answers 201 with a visit that carries none. That is not a
      // success the officer should be told about in one line: the figures typed in
      // the street are gone from the server. Keep the form as it is (nothing typed
      // is thrown away), keep the request id (pressing submit again replays this
      // visit rather than filing a second), and say which figures were lost.
      const lost = serviceFields.filter(
        (field) => input.details?.[field.key] !== undefined && stored.details?.[field.key] == null,
      );
      if (lost.length > 0) {
        setUnsaved(
          lost.map((field) => {
            const value = input.details![field.key];
            const option = field.options?.find((o) => o.value === value);
            return { key: field.key, label: text(field.en, field.hi), shown: option ? text(option.en, option.hi) : String(value) };
          }),
        );
        return;
      }
      setSaved(stored.id);
      setWard("");
      setServiceId("");
      setDetails({});
      setIssueAction("");
      setGps(null);
      setVisitTime(indiaTimeOfDay(clock()));
      setTimeTyped(false);
      intentRef.current = null;
    } catch (error) {
      if (error instanceof RequestError) {
        setServerError(translate(error.detail.message));
        setErrors(normalizeFieldErrors(error.detail.fieldErrors));
      } else {
        setServerError(text("Could not record the visit. Try again.", "निरीक्षण दर्ज नहीं हो सका। पुनः प्रयास करें।"));
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const ready = gps !== null && !capturing;
  const shownKeys = new Set([...PLACED, ...serviceFields.map((f) => `details.${f.key}`)]);
  // A message for a key the form has no control for is listed at the top, and it
  // must say WHICH key: the server's text for an undefined detail does not, and a
  // banner saying "correct the highlighted fields" with nothing highlighted is the
  // dead end this form must not have. The key is unique per entry, so it is also the
  // React key (two refusals with the same words are still two notices).
  const unplaced = Object.entries(errors)
    .filter(([key]) => !shownKeys.has(key))
    .map(([key, message]) => ({ key, name: key.replace(/^details\./, ""), message }));

  function detailControl(field: VisitField) {
    const label = text(field.en, field.hi);
    const id = `detail-${field.key}`;
    const value = details[field.key] ?? "";
    const error = errors[`details.${field.key}`];
    const common = { id, value, onChange: (e: { target: { value: string } }) => changeDetail(field.key, e.target.value) };
    const message = error && <FieldError>{translate(error)}</FieldError>;
    if (field.type === "select")
      return (
        <Field key={field.key}>
          {label}
          <select {...common}>
            <option value="">{text("Select", "चुनें")}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>{text(option.en, option.hi)}</option>
            ))}
          </select>
          {message}
        </Field>
      );
    if (field.type === "textarea")
      return (
        <Field key={field.key} className="lg:col-span-2">
          {label}
          <textarea {...common} rows={3} maxLength={bounds.textAreaMax} />
          {message}
        </Field>
      );
    if (field.type === "number")
      return (
        <Field key={field.key}>
          {label}
          <input
            {...common}
            type="number"
            min={0}
            max={bounds.numberMax}
            // A count takes a whole number: the digit keypad and a step of one. A
            // measurement may carry a decimal: the decimal keypad and any step.
            step={field.integer ? 1 : "any"}
            inputMode={field.integer ? "numeric" : "decimal"}
          />
          {message}
        </Field>
      );
    return (
      <Field key={field.key}>
        {label}
        <input {...common} type="text" maxLength={bounds.textMax} />
        {message}
      </Field>
    );
  }

  return (
    <Panel className="border-0 bg-transparent p-0 sm:p-0 lg:max-w-3xl lg:border lg:bg-card lg:p-6">
      <div className="mb-4 grid gap-1">
        <h1 className={`text-[23px] font-semibold ${leadingHeading}`}>{text("Record a field visit", "क्षेत्रीय निरीक्षण दर्ज करें")}</h1>
        <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
          {officer.name} · {officer.designation} · {day}
        </p>
      </div>
      {(saved || serverError || unsaved.length > 0 || unplaced.length > 0) && (
        <div className="mb-4 grid gap-3">
          {saved && (
            <Notice role="status">
              {text("Visit recorded.", "निरीक्षण दर्ज हो गया।")}
            </Notice>
          )}
          {unsaved.length > 0 && (
            <Notice>
              {text(
                "The visit was recorded, but its details were not saved. They are still in the form below. Do not file the visit again; report these figures to your supervisor:",
                "निरीक्षण दर्ज हो गया, लेकिन उसके विवरण सहेजे नहीं गए। वे नीचे फ़ॉर्म में अभी भी हैं। निरीक्षण दोबारा दर्ज न करें; ये आंकड़े अपने पर्यवेक्षक को बताएँ:",
              )}
              <ul className="mt-1.5 grid gap-0.5">
                {unsaved.map((item) => (
                  <li key={item.key}>{`${item.label}: ${item.shown}`}</li>
                ))}
              </ul>
            </Notice>
          )}
          {serverError && <Notice>{serverError}</Notice>}
          {unplaced.map(({ key, name, message }) => (
            <Notice key={key}>{`${name}: ${translate(message)}`}</Notice>
          ))}
        </div>
      )}
      <form onSubmit={submit} noValidate className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-x-5 lg:gap-y-4">
        <section
          aria-labelledby={locationId}
          className={cn("grid min-w-0 gap-2 rounded-lg border p-3.5 lg:col-span-2", gps ? "border-primary/25 bg-accent" : "border-border bg-card")}
        >
          <div className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-[15px] shrink-0 text-primary" />
            <h2 id={locationId} className={`text-[12.5px] font-semibold ${leadingBody} text-primary`}>
              {gps ? text("Location captured", "स्थान कैप्चर हो गया") : text("Location", "स्थान")}
            </h2>
            {gps && (
              <span className={`ml-auto text-[11.5px] ${leadingBody} text-muted-foreground`}>±{Math.round(gps.accuracyMetres)} m</span>
            )}
          </div>
          {gps && (
            <>
              <span className={`font-mono text-[12.5px] tabular-nums ${leadingBody} text-foreground`}>
                {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
              </span>
              <a
                href={mapUrl(gps)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("inline-flex min-h-[44px] w-fit items-center text-[12.5px] font-medium", leadingBody, "text-primary underline underline-offset-2 hover:text-foreground", focusRing)}
              >
                {text("Open in Google Maps", "गूगल मैप्स में खोलें")}
              </a>
            </>
          )}
          {!gps && (
            <p className={`text-xs ${leadingHelp} text-muted-foreground`}>
              {text(
                "Capture the location at the site before you can submit this visit.",
                "निरीक्षण जमा करने से पहले मौके पर स्थान कैप्चर करें।",
              )}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full lg:w-auto lg:justify-self-start"
            onClick={() => void capture()}
            disabled={capturing}
          >
            {capturing
              ? text("Capturing…", "कैप्चर हो रहा है…")
              : gps
                ? text("Capture location again", "स्थान पुनः कैप्चर करें")
                : text("Capture location", "स्थान कैप्चर करें")}
          </Button>
          {captureError && <FieldError role="alert">{captureMessages[captureError]}</FieldError>}
          {errors.gps && <FieldError>{translate(errors.gps)}</FieldError>}
        </section>
        <Field>
          {text("Anchal", "अंचल")}
          <select value={officeId} onChange={(e) => setOfficeId(Number(e.target.value))} required>
            {ANCHALS.map((id) => (
              <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
            ))}
          </select>
          {errors.officeId && <FieldError>{translate(errors.officeId)}</FieldError>}
        </Field>
        <Field>
          {text("Ward", "वार्ड")}
          <select
            value={ward}
            onChange={(e) => setWard(e.target.value === "" ? "" : Number(e.target.value))}
            required
          >
            <option value="">{text("Select a ward", "वार्ड चुनें")}</option>
            {WARDS.map((number) => (
              <option key={number} value={number}>{number}</option>
            ))}
          </select>
          {errors.ward && <FieldError>{translate(errors.ward)}</FieldError>}
        </Field>
        <Field>
          {text("Activity", "गतिविधि")}
          <select
            value={serviceId}
            onChange={(e) => changeService(e.target.value === "" ? "" : Number(e.target.value))}
            required
          >
            <option value="">{text("Select an activity", "गतिविधि चुनें")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {`${String(service.id).padStart(2, "0")} · ${text(service.en, service.name)}`}
              </option>
            ))}
          </select>
          {errors.serviceId && <FieldError>{translate(errors.serviceId)}</FieldError>}
        </Field>
        <div className="grid min-w-0 gap-1.5">
          <span className={`text-[11px] font-medium ${leadingBody} text-muted-foreground`}>{text(labels.date[0], labels.date[1])}</span>
          <span
            data-visit-date=""
          id={dateId}
          aria-invalid={errors.visitDate ? true : undefined}
          aria-describedby={errors.visitDate ? `${dateId}-error` : undefined}
            className={`flex min-h-[44px] items-center rounded-[7px] border border-border bg-muted px-3 font-mono text-[16px] tabular-nums lg:text-[13.5px] ${leadingBody} text-foreground`}
          >
            {day}
          </span>
          {errors.visitDate && (
            <FieldError id={`${dateId}-error`} role="alert">{translate(errors.visitDate)}</FieldError>
          )}
        </div>
        <Field>
          {text("Time of visit", "निरीक्षण का समय")}
          <input type="time" value={visitTime} onChange={(e) => { setVisitTime(e.target.value); setTimeTyped(true); }} required />
          {errors.visitTime && <FieldError>{translate(errors.visitTime)}</FieldError>}
        </Field>
        {serviceFields.map(detailControl)}
        <Field className="lg:col-span-2">
          {text(labels.description[0], labels.description[1])}
          <textarea
            className="scroll-mb-28"
            rows={4}
            maxLength={4000}
            value={issueAction}
            onChange={(e) => setIssueAction(e.target.value)}
            required
          />
          {errors.issueAction && <FieldError>{translate(errors.issueAction)}</FieldError>}
          <span className="block text-muted-foreground">
            {text(`${issueAction.length} of 4000 characters`, `4000 में से ${issueAction.length} अक्षर`)}
          </span>
        </Field>
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-input bg-muted p-3.5 lg:col-span-2">
          <Camera aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="grid min-w-0 gap-px">
            <span className={`text-[13.5px] font-medium ${leadingBody} text-muted-foreground`}>{text("Photographs", "फ़ोटो")}</span>
            <span className={`text-xs ${leadingHelp} text-muted-foreground`}>
              {text(
                "Photographs are not being collected — switched off for now, at RMC's request.",
                "संग्रहित नहीं किए जा रहे — रांची नगर निगम के अनुरोध पर अभी बंद।",
              )}
            </span>
          </div>
        </div>
        {/* On a phone the submit sits on the bottom edge of the screen while the form
            is in view, so it is reachable without scrolling past the fields. The
            negative margins bleed it to the screen edge, undoing the shell's padding. */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-8 border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-8 sm:-mb-10 sm:px-8 lg:static lg:col-span-2 lg:m-0 lg:border-0 lg:bg-transparent lg:p-0">
          <Button className="w-full lg:w-auto" type="submit" disabled={!ready || saving}>
            {saving ? text("Submitting…", "जमा हो रहा है…") : text("Submit visit", "निरीक्षण जमा करें")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
