import { api } from "./api";
import type { FieldVisitInput, FieldVisitView } from "../shared/types";

export type VisitFilters = {
  from: string;
  to: string;
  officeId?: number;
  ward?: number;
  serviceId?: number;
  officerId?: string;
  page?: number;
};

export type VisitPage = { rows: FieldVisitView[]; total: number };

export function createVisit(
  input: FieldVisitInput,
  requestId: string,
): Promise<FieldVisitView> {
  return api<FieldVisitView>("/field-visits", "POST", { requestId, input });
}

export function listVisits(filters: VisitFilters): Promise<VisitPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return api<VisitPage>(`/field-visits?${query.toString()}`);
}

export function voidVisit(id: string, reason: string): Promise<FieldVisitView> {
  return api<FieldVisitView>(
    `/field-visits/${encodeURIComponent(id)}/void`,
    "POST",
    { reason },
  );
}
