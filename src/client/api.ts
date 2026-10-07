import type { ApiError } from "../shared/types";

const defaultApiBase =
  import.meta.env.VITE_ANCHAL_API_BASE_URL?.trim() || "/v1/api/anchal";

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

function requestUrl(path: string, apiBase = defaultApiBase) {
  return `${apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  apiBase?: string,
): Promise<{ response: Response; data: T }> {
  const response = await fetch(requestUrl(path, apiBase), {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T | ApiError;
  if (!response.ok) throw new RequestError(data as ApiError, response.status);
  return { response, data: data as T };
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  apiBase?: string,
): Promise<T> {
  return (await request<T>(path, method, body, apiBase)).data;
}

export async function apiRead<T>(
  path: string,
  apiBase?: string,
): Promise<ApiRead<T>> {
  const { response, data } = await request<T>(path, "GET", undefined, apiBase);
  return {
    data,
    retrievedAt: response.headers.get("X-Monitoring-Retrieved-At"),
    lastUpdated: response.headers.get("X-Monitoring-Last-Updated"),
    revision: response.headers.get("X-Monitoring-Revision"),
  };
}
