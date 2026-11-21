import { useText } from "../i18n";
import type { GpsReading } from "../../shared/types";

export function mapUrl(gps: Pick<GpsReading, "latitude" | "longitude">): string {
  return `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`;
}

// Where a visit was recorded: the stored coordinates, the accuracy the device
// reported, and a link that opens the point in Google Maps. No verdict is passed
// on the reading — the register shows what was captured and the reader judges.
export default function VisitLocation({ gps, ward }: { gps: GpsReading; ward: number }) {
  const text = useText();
  return (
    <>
      <span className="visit-coords">
        {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{Math.round(gps.accuracyMetres)} m
      </span>
      <a
        className="visit-map-link"
        href={mapUrl(gps)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={text(`Open in Google Maps — Ward ${ward}`, `गूगल मैप्स में खोलें — वार्ड ${ward}`)}
      >
        {text("Open in Google Maps", "गूगल मैप्स में खोलें")}
      </a>
    </>
  );
}
