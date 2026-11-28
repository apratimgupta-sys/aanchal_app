import { api } from "./api";
import type { DayRow, MonitoringRow, ServiceRow, VisitSummary } from "../shared/types";

// The Commissioner dashboard's four reads. Each section of the page makes one
// of them with its own filters; the server does all the adding up.
export type DashboardQuery = { from: string; to: string; officeId?: number; serviceId?: number };

function search(query: DashboardQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.officeId !== undefined) params.set("officeId", String(query.officeId));
  if (query.serviceId !== undefined) params.set("serviceId", String(query.serviceId));
  return params.toString();
}

export type AnchalRows = { rows: MonitoringRow[]; updatedAt: string; retrievedAt?: string };

export const getAnchalRows = (query: DashboardQuery) => api<AnchalRows>(`/dashboard?${search(query)}`);

export const getServiceRows = (query: Omit<DashboardQuery, "serviceId">) =>
  api<{ rows: ServiceRow[] }>(`/dashboard/services?${search(query)}`);

export const getDayRows = (query: DashboardQuery) => api<{ rows: DayRow[] }>(`/dashboard/days?${search(query)}`);

export const getVisitSummary = (query: Omit<DashboardQuery, "serviceId">) =>
  api<VisitSummary>(`/field-visits/summary?${search(query)}`);
