import { describe, expect, it } from "vitest";
import {
  GeolocationCaptureError,
  capturePosition,
} from "../../src/client/lib/geolocation";

type SuccessFn = (position: GeolocationPosition) => void;
type ErrorFn = (error: GeolocationPositionError) => void;

function stubGeolocation(
  behaviour: (success: SuccessFn, failure: ErrorFn, options?: PositionOptions) => void,
) {
  const seen: { options?: PositionOptions } = {};
  const geo = {
    getCurrentPosition(success: SuccessFn, failure: ErrorFn, options?: PositionOptions) {
      seen.options = options;
      behaviour(success, failure, options);
    },
    watchPosition: () => 0,
    clearWatch: () => {},
  } as unknown as Geolocation;
  return { geo, seen };
}

function position(overrides: Partial<GeolocationCoordinates> = {}, timestamp = 1_763_541_000_000) {
  return {
    coords: { latitude: 23.3441, longitude: 85.3096, accuracy: 18, ...overrides },
    timestamp,
  } as GeolocationPosition;
}

function positionError(code: number): GeolocationPositionError {
  return { code, message: "", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

describe("capturePosition", () => {
  it("returns a reading from a successful fix", async () => {
    const { geo } = stubGeolocation((success) => success(position()));
    await expect(capturePosition(geo)).resolves.toEqual({
      latitude: 23.3441,
      longitude: 85.3096,
      accuracyMetres: 18,
      capturedAt: new Date(1_763_541_000_000).toISOString(),
    });
  });

  it("asks for a high-accuracy fix and refuses a cached one", async () => {
    const { geo, seen } = stubGeolocation((success) => success(position()));
    await capturePosition(geo);
    expect(seen.options?.enableHighAccuracy).toBe(true);
    expect(seen.options?.maximumAge).toBe(0);
    expect(seen.options?.timeout).toBeGreaterThan(0);
  });

  it("maps PERMISSION_DENIED to kind 'denied'", async () => {
    const { geo } = stubGeolocation((_, failure) => failure(positionError(1)));
    await expect(capturePosition(geo)).rejects.toMatchObject({ kind: "denied" });
  });

  it("maps POSITION_UNAVAILABLE to kind 'unavailable'", async () => {
    const { geo } = stubGeolocation((_, failure) => failure(positionError(2)));
    await expect(capturePosition(geo)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps TIMEOUT to kind 'timeout'", async () => {
    const { geo } = stubGeolocation((_, failure) => failure(positionError(3)));
    await expect(capturePosition(geo)).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps an unrecognised error code to kind 'unavailable'", async () => {
    const { geo } = stubGeolocation((_, failure) => failure(positionError(99)));
    await expect(capturePosition(geo)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("rejects with kind 'unsupported' when the browser has no geolocation", async () => {
    await expect(capturePosition(undefined)).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("rejects with a GeolocationCaptureError, so callers can narrow on it", async () => {
    const { geo } = stubGeolocation((_, failure) => failure(positionError(1)));
    await expect(capturePosition(geo)).rejects.toBeInstanceOf(GeolocationCaptureError);
  });
});
