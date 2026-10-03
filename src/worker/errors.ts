import type { ApiError } from "../shared/types";
export class HttpError extends Error {
  constructor(
    public status: number,
    public detail: ApiError,
  ) {
    super(detail.message);
  }
}
export function fail(
  status: number,
  message: string,
  code = "VALIDATION",
): never {
  throw new HttpError(status, { code, message });
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
