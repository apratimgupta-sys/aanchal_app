import type { ApiError } from "../shared/types";

const inFlightGets = new Map<string, Promise<unknown>>();
const apiBase = "/v1/api/anchal";
export class RequestError extends Error {
  constructor(
    public detail: ApiError,
    public status: number,
  ) {
    super(detail.message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const requestKey = method === "GET" && body === undefined ? path : null;
  if (requestKey) {
    const existing = inFlightGets.get(requestKey);
    if (existing) return existing as Promise<T>;
  }

  const request = (async () => {
  const r = await fetch(apiBase + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new RequestError(data as ApiError, r.status);
  return data as T;
  })();

  if (requestKey) {
    inFlightGets.set(requestKey, request);
    const clearRequest = () => {
      if (inFlightGets.get(requestKey) === request) inFlightGets.delete(requestKey);
    };
    void request.then(clearRequest, clearRequest);
  }
  return request;
}
