import services from "../shared/services.json" with { type: "json" };
import { dailyEntryCollects, formShape } from "./service-kind";

// The services the daily entry collects, in the order the entry form lists
// them: the services that keep a queue first, then the collections, each group
// in service-master order. The dashboard lists and numbers services the same
// way, so the Commissioner and the clerk mean the same thing by "service 08".
//
// TWIN: the entry form builds the same list for itself (GROUPS and
// displayNumber in src/client/pages/DailyEntry.tsx). Both are held against the
// hand-written oracle in tests/ui/service-position.ts.
const afterTheQueues = (serviceId: number) => (formShape(serviceId) === "revenue" ? 1 : 0);

export const DAILY_SERVICES = services
  .filter((s) => dailyEntryCollects(s.id))
  .map((service, index) => ({ service, index }))
  .sort((a, b) => afterTheQueues(a.service.id) - afterTheQueues(b.service.id) || a.index - b.index)
  .map((x) => x.service);

const NUMBER = new Map<number, string>(DAILY_SERVICES.map((s, i) => [s.id, String(i + 1).padStart(2, "0")]));

// The service's place in that list as the entry form prints it ("01" to "10").
// Display only: the id is what is stored and sent.
export function displayNumber(serviceId: number): string {
  const number = NUMBER.get(serviceId);
  if (number === undefined) throw new Error(`Service ${serviceId} is not on the daily entry`);
  return number;
}
