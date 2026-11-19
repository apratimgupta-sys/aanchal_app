import type { GpsReading } from "../../shared/types";

export type GeolocationFailureKind =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export class GeolocationCaptureError extends Error {
  constructor(public kind: GeolocationFailureKind) {
    super(`Geolocation capture failed: ${kind}`);
    this.name = "GeolocationCaptureError";
  }
}

const CAPTURE_TIMEOUT_MS = 15_000;

function kindFor(code: number): GeolocationFailureKind {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  // Anything the browser does not classify is treated as an unavailable fix
  // rather than a denial: the officer may simply be indoors.
  return "unavailable";
}

export function capturePosition(
  geo: Geolocation | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.geolocation,
): Promise<GpsReading> {
  if (!geo) return Promise.reject(new GeolocationCaptureError("unsupported"));
  return new Promise<GpsReading>((resolve, reject) => {
    geo.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMetres: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      (error) => reject(new GeolocationCaptureError(kindFor(error.code))),
      {
        enableHighAccuracy: true,
        timeout: CAPTURE_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });
}
