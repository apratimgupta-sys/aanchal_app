import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { Mock } from "vitest";
import { Language } from "../../src/client/i18n";
import type { DayRow, MonitoringRow, ServiceRow, VisitServiceSummary, VisitSummary } from "../../src/shared/types";
import { FIELD_WORK_IDS } from "./service-position";

export const anchalRow = (over: Partial<MonitoringRow> = {}): MonitoringRow => ({
  officeId: 1, received: 40, completed: 30, slaWithinTime: 0, pending: 12, disposalPct: 75, slaPct: null,
  amountPaise: 250000, complaintsPending: 0, fieldPending: 0, workDone: 0, submitted: 10, expected: 10,
  configured: true, reviewReasons: [], ...over,
});

export const serviceRow = (serviceId: number, over: Partial<ServiceRow> = {}): ServiceRow => ({
  serviceId, received: 0, completed: 0, pending: 0, disposalPct: null, amountPaise: 0, ...over,
});

export const dayRow = (date: string, over: Partial<DayRow> = {}): DayRow => ({
  date, received: 0, completed: 0, amountPaise: 0, ...over,
});

export const visitService = (serviceId: number, over: Partial<VisitServiceSummary> = {}): VisitServiceSummary => ({
  serviceId, visits: 0, wardsCovered: 0, numbers: [], choices: [], ...over,
});

// All eight field-work services at zero, as the server sends them when nothing was filed.
export const visitSummary = (over: Partial<VisitSummary> = {}): VisitSummary => ({
  visits: 0, officers: 0, services: FIELD_WORK_IDS.map((id) => visitService(id)), wards: [], ...over,
});

export type Answers = {
  anchals?: MonitoringRow[];
  updatedAt?: string;
  retrievedAt?: string;
  services?: ServiceRow[];
  days?: DayRow[];
  summary?: VisitSummary;
};

// Answers each of the dashboard's four reads by its path. A request for anything else fails the test.
export function route(api: Mock, answers: Answers = {}) {
  api.mockImplementation(async (path: string) => {
    if (path.startsWith("/dashboard/services")) return { rows: answers.services ?? [] };
    if (path.startsWith("/dashboard/days")) return { rows: answers.days ?? [] };
    if (path.startsWith("/field-visits/summary")) return answers.summary ?? visitSummary();
    if (path.startsWith("/dashboard?")) {
      return {
        rows: answers.anchals ?? [],
        updatedAt: answers.updatedAt ?? "2026-11-20T05:00:00.000Z",
        ...(answers.retrievedAt === undefined ? {} : { retrievedAt: answers.retrievedAt }),
      };
    }
    throw new Error(`unexpected request: ${path}`);
  });
}

// The paths asked for so far that start with `prefix`, oldest first.
export const paths = (api: Mock, prefix: string): string[] =>
  api.mock.calls.map((call) => String(call[0])).filter((path) => path.startsWith(prefix));

export function renderWithin(ui: ReactElement, lang: "en" | "hi" = "en"): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>{ui}</Language.Provider>
    </QueryClientProvider>,
  );
  return client;
}
