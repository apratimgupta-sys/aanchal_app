import { useId, useRef, useState, type FormEvent } from "react";
import { Camera, MapPin } from "lucide-react";
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
import { Language, runtimeText, useText } from "../i18n";
import { cn } from "../lib/utils";
import { mapUrl } from "../components/VisitLocation";
import { Button, Field, FieldError, Notice, Panel, focusRing, leadingBody, leadingHeading, leadingHelp } from "../ui";
import { mutationIntent, type MutationIntent } from "../mutation";
import { useContext } from "react";

const ANCHALS = [1, 2, 3, 4, 5, 6];
const WARDS = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => WARD_MIN + i);

function timeOf(now: Date): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

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
  const lang = useContext(Language);
  const translate = (message: string) => runtimeText(message, lang);
  const [officeId, setOfficeId] = useState(officer.homeOfficeId);
  const [ward, setWard] = useState<number | "">("");
  const [serviceId, setServiceId] = useState<number | "">("");
  const [issueAction, setIssueAction] = useState("");
  const [visitTime, setVisitTime] = useState(() => timeOf(clock()));
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<GeolocationFailureKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
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
      setGps(await capturePosition());
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
    if (submittingRef.current) return;
    const input = currentInput();
    const found = validateVisitInput(input, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const next = mutationIntent(intentRef.current, input);
    intentRef.current = next;
    submittingRef.current = true;
    setSaving(true);
    try {
      const stored = await createVisit(input, next.requestId);
      setSaved(stored.id);
      setWard("");
      setServiceId("");
      setIssueAction("");
      setGps(null);
      setVisitTime(timeOf(clock()));
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

  return (
    <Panel className="border-0 bg-transparent p-0 sm:p-0 lg:max-w-3xl lg:border lg:bg-card lg:p-6">
      <div className="mb-4 grid gap-1">
        <h1 className={`text-[23px] font-semibold ${leadingHeading}`}>{text("Record a field visit", "क्षेत्रीय निरीक्षण दर्ज करें")}</h1>
        <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
          {officer.name} · {officer.designation} · {today}
        </p>
      </div>
      {(saved || serverError) && (
        <div className="mb-4 grid gap-3">
          {saved && (
            <Notice role="status">
              {text("Visit recorded.", "निरीक्षण दर्ज हो गया।")}
            </Notice>
          )}
          {serverError && <Notice>{serverError}</Notice>}
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
          {errors.serviceId && <FieldError>{translate(errors.serviceId)}</FieldError>}
        </Field>
        <Field>
          {text("Time of visit", "निरीक्षण का समय")}
          <input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} required />
          {errors.visitTime && <FieldError>{translate(errors.visitTime)}</FieldError>}
        </Field>
        <Field className="lg:col-span-2">
          {text("Issue / Action", "समस्या / कार्रवाई")}
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
