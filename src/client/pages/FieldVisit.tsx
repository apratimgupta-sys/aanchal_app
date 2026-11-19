import { useState, type FormEvent } from "react";
import services from "../../shared/services.json";
import type { FieldVisitInput, GpsReading, OfficerProfile } from "../../shared/types";
import { validateVisitInput, WARD_MAX, WARD_MIN } from "../../domain/visit";
import { RequestError } from "../api";
import { createVisit } from "../field-visits";
import { normalizeFieldErrors } from "../field-errors";
import {
  GeolocationCaptureError,
  capturePosition,
  type GeolocationFailureKind,
} from "../lib/geolocation";
import { useText } from "../i18n";
import { Field, Notice, Panel } from "../ui";
import { mutationIntent, type MutationIntent } from "../mutation";

const ANCHALS = [1, 2, 3, 4, 5, 6];
const WARDS = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => WARD_MIN + i);

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function FieldVisit({
  officer,
  today,
}: {
  officer: OfficerProfile;
  today: string;
}) {
  const text = useText();
  const [officeId, setOfficeId] = useState(officer.homeOfficeId);
  const [ward, setWard] = useState<number | "">("");
  const [serviceId, setServiceId] = useState<number | "">("");
  const [issueAction, setIssueAction] = useState("");
  const [visitTime, setVisitTime] = useState(nowTime);
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<GeolocationFailureKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [intent, setIntent] = useState<MutationIntent | null>(null);

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
      setGps(await capturePosition());
    } catch (error) {
      setGps(null);
      setCaptureError(
        error instanceof GeolocationCaptureError ? error.kind : "unavailable",
      );
    } finally {
      setCapturing(false);
    }
  }

  function currentInput(): FieldVisitInput {
    return {
      visitDate: today,
      visitTime,
      officeId,
      ward: ward === "" ? 0 : ward,
      serviceId: serviceId === "" ? 0 : serviceId,
      gps: gps ?? { latitude: Number.NaN, longitude: Number.NaN, accuracyMetres: Number.NaN, capturedAt: "" },
      issueAction,
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSaved(null);
    const input = currentInput();
    const found = validateVisitInput(input, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const next = mutationIntent(intent, input);
    setIntent(next);
    setSaving(true);
    try {
      const stored = await createVisit(input, next.requestId);
      setSaved(stored.id);
      setWard("");
      setServiceId("");
      setIssueAction("");
      setGps(null);
      setIntent(null);
    } catch (error) {
      if (error instanceof RequestError) {
        setServerError(error.detail.message);
        setErrors(normalizeFieldErrors(error.detail.fieldErrors));
      } else {
        setServerError(text("Could not record the visit. Try again.", "निरीक्षण दर्ज नहीं हो सका। पुनः प्रयास करें।"));
      }
    } finally {
      setSaving(false);
    }
  }

  const ready = gps !== null && !capturing;

  return (
    <main id="main-content" tabIndex={-1} className="workspace">
      <Panel>
        <h1>{text("Record a field visit", "क्षेत्रीय निरीक्षण दर्ज करें")}</h1>
        <p>
          {officer.name} · {officer.designation} · {today}
        </p>
        {saved && (
          <Notice role="status">
            {text("Visit recorded.", "निरीक्षण दर्ज हो गया।")}
          </Notice>
        )}
        {serverError && <Notice>{serverError}</Notice>}
        <form onSubmit={submit} noValidate>
          <Field>
            {text("Time of visit", "निरीक्षण का समय")}
            <input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} required />
            {errors.visitTime && <span className="field-error">{errors.visitTime}</span>}
          </Field>
          <Field>
            {text("Anchal", "अंचल")}
            <select value={officeId} onChange={(e) => setOfficeId(Number(e.target.value))} required>
              {ANCHALS.map((id) => (
                <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
              ))}
            </select>
            {errors.officeId && <span className="field-error">{errors.officeId}</span>}
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
            {errors.ward && <span className="field-error">{errors.ward}</span>}
          </Field>
          <Field>
            {text("Activity", "गतिविधि")}
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value === "" ? "" : Number(e.target.value))}
              required
            >
              <option value="">{text("Select an activity", "गतिविधि चुनें")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {`${String(service.id).padStart(2, "0")} · ${text(service.en, service.name)}`}
                </option>
              ))}
            </select>
            {errors.serviceId && <span className="field-error">{errors.serviceId}</span>}
          </Field>
          <div className="ui-field">
            <span>{text("Location", "स्थान")}</span>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
              onClick={() => void capture()}
              disabled={capturing}
            >
              {capturing
                ? text("Capturing…", "कैप्चर हो रहा है…")
                : gps
                  ? text("Capture location again", "स्थान पुनः कैप्चर करें")
                  : text("Capture location", "स्थान कैप्चर करें")}
            </button>
            {gps && (
              <p className="ui-help">
                {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{Math.round(gps.accuracyMetres)} m
              </p>
            )}
            {captureError && <p className="ui-help ui-error">{captureMessages[captureError]}</p>}
            {errors.gps && <span className="field-error">{errors.gps}</span>}
          </div>
          <Field>
            {text("Issue / Action", "समस्या / कार्रवाई")}
            <textarea
              rows={5}
              value={issueAction}
              onChange={(e) => setIssueAction(e.target.value)}
              required
            />
            {errors.issueAction && <span className="field-error">{errors.issueAction}</span>}
          </Field>
          <button
            className="ux4g-btn ux4g-btn-l ux4g-btn-primary"
            type="submit"
            disabled={!ready || saving}
          >
            {saving ? text("Submitting…", "जमा हो रहा है…") : text("Submit visit", "निरीक्षण जमा करें")}
          </button>
        </form>
      </Panel>
    </main>
  );
}
