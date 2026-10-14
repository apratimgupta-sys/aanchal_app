import type { ApiError } from "../shared/types";

const apiPrefix = "/v1/api/anchal";
const defaultApiOrigin = import.meta.env.VITE_ANCHAL_API_ORIGIN?.trim() || "";
const inFlightGets = new Map<string, Promise<unknown>>();

export type ApiRead<T> = {
  data: T;
  retrievedAt: string | null;
  lastUpdated: string | null;
  revision: string | null;
};

export class RequestError extends Error {
  constructor(
    public detail: ApiError,
    public status: number,
  ) {
    super(detail.message);
    this.name = "RequestError";
  }
}

function requestUrl(path: string, apiOrigin = defaultApiOrigin) {
  return `${apiOrigin.replace(/\/$/, "")}${apiPrefix}/${path.replace(/^\//, "")}`;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  apiOrigin?: string,
): Promise<{ response: Response; data: T }> {
  const response = await fetch(requestUrl(path, apiOrigin), {
    method,
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: T | ApiError;
  try {
    data = JSON.parse(text) as T | ApiError;
  } catch {
    data = {
      code: `HTTP_${response.status}`,
      message: text || "The monitoring service returned an invalid response",
    };
  }
  if (!response.ok) throw new RequestError(data as ApiError, response.status);
  return { response, data: data as T };
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  apiOrigin?: string,
): Promise<T> {
  const requestKey =
    method === "GET" && body === undefined
      ? `${apiOrigin ?? defaultApiOrigin}\u0000${path}`
      : null;
  if (requestKey) {
    const existing = inFlightGets.get(requestKey);
    if (existing) return existing as Promise<T>;
  }

  const pending = request<T>(path, method, body, apiOrigin).then(
    ({ data }) => data,
  );
  if (requestKey) {
    inFlightGets.set(requestKey, pending);
    const clearRequest = () => {
      if (inFlightGets.get(requestKey) === pending)
        inFlightGets.delete(requestKey);
    };
    void pending.then(clearRequest, clearRequest);
  }
  return pending;
}

export async function apiRead<T>(
  path: string,
  apiOrigin?: string,
): Promise<ApiRead<T>> {
  const { response, data } = await request<T>(path, "GET", undefined, apiOrigin);
  return {
    data,
    retrievedAt: response.headers.get("X-Monitoring-Retrieved-At"),
    lastUpdated: response.headers.get("X-Monitoring-Last-Updated"),
    revision: response.headers.get("X-Monitoring-Revision"),
  };
}
