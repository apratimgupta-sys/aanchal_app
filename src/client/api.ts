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
  // 204 carries no body, and an error page or a proxy fault may carry one
  // that is not JSON. Parsing unconditionally turned a successful password
  // change into "Could not change the password. Try again."
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok)
    throw new RequestError(
      (data as ApiError | null) ?? { code: "UNKNOWN", message: `Request failed (${r.status})` },
      r.status,
    );
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
