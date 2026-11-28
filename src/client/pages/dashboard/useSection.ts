import { useContext } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Language, runtimeText, useText } from "../../i18n";
import { todayIST } from "../../../domain/ledger";
import { periodRange, type PeriodValue } from "../../../domain/period";
import type { DashboardQuery } from "../../dashboard-data";

// One section's data call. The key starts with "dashboard", so the page's one
// refresh reaches every section; a period that cannot be asked for asks nothing.
export function useSection<T>(
  name: string,
  period: PeriodValue,
  params: { officeId?: number; serviceId?: number },
  read: (query: DashboardQuery) => Promise<T>,
): { data: T | undefined; range: { from: string; to: string } | null; error: string | null } {
  const lang = useContext(Language);
  const t = useText();
  const range = periodRange(period, todayIST());
  const query = useQuery({
    queryKey: ["dashboard", name, range, params],
    queryFn: () => read({ ...range!, ...params }),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
  let error: string | null = null;
  if (period.kind === "custom" && period.from !== "" && period.to !== "" && range === null) {
    error = t(
      "Start date must be on or before the end date.",
      "आरंभ तिथि समाप्ति तिथि से पहले या उसी दिन होनी चाहिए।",
    );
  } else if (query.error) {
    error = runtimeText((query.error as Error).message, lang);
  }
  // No figures without a valid range or after a failed request: the last period's
  // figures are kept only while a new valid choice is loading.
  const data = range === null || query.error ? undefined : query.data;
  return { data, range, error };
}
