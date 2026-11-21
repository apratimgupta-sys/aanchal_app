import { useText } from "../i18n";
import { cn } from "../lib/utils";
import { focusRing, leadingBody } from "../ui";
import type { FieldVisitView, GpsReading } from "../../shared/types";

// Fixed-point, trailing zeros trimmed: String(1e-7) would be "1e-7", which a
// map query cannot read.
function coordinate(value: number): string {
  return value.toFixed(8).replace(/\.?0+$/, "");
}

export function mapUrl(gps: Pick<GpsReading, "latitude" | "longitude">): string {
  return `https://maps.google.com/?q=${coordinate(gps.latitude)},${coordinate(gps.longitude)}`;
}

// A reading is absent when there is nothing to point at: no gps, a coordinate
// that is not a number, or exactly 0,0 (what a device reports when it has no
// fix). This is a fact about the data, not a judgment about plausibility —
// nothing here asks whether a position is believable.
function hasPosition(gps: FieldVisitView["gps"]): gps is GpsReading {
  if (!gps) return false;
  const { latitude, longitude } = gps;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return !(latitude === 0 && longitude === 0);
}

// Where a visit was recorded: the stored coordinates, the accuracy the device
// reported, and a link that opens the point in Google Maps. No verdict is passed
// on the reading — the register shows what was captured and the reader judges.
export default function VisitLocation({
  gps,
  ward,
  visitDate,
  visitTime,
}: {
  gps: FieldVisitView["gps"];
  ward: number;
  visitDate: string;
  visitTime: string;
}) {
  const text = useText();
  if (!hasPosition(gps))
    return (
      <span className={`text-[12.5px] ${leadingBody} text-muted-foreground`}>{text("No location recorded", "कोई स्थान दर्ज नहीं")}</span>
    );
  return (
    <>
      <span className={`font-mono text-[12.5px] tabular-nums ${leadingBody} text-muted-foreground`}>
        {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{Math.round(gps.accuracyMetres)} m
      </span>
      <a
        className={cn("inline-flex min-h-[44px] w-fit items-center text-[12.5px] font-medium", leadingBody, "text-primary underline underline-offset-2 hover:text-foreground", focusRing)}
        href={mapUrl(gps)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={text(
          `Open in Google Maps — Ward ${ward}, ${visitDate} ${visitTime}`,
          `गूगल मैप्स में खोलें — वार्ड ${ward}, ${visitDate} ${visitTime}`,
        )}
      >
        {text("Open in Google Maps", "गूगल मैप्स में खोलें")}
      </a>
    </>
  );
}
