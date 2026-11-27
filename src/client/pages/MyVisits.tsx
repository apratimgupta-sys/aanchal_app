import { useQuery } from "@tanstack/react-query";
import services from "../../shared/services.json";
import type { FieldVisitView } from "../../shared/types";
import { listVisits } from "../field-visits";
import { indiaToday } from "../lib/dates";
import { myVisitsQueryKey } from "../session-caches";
import { useText } from "../i18n";
import VisitLocation from "../components/VisitLocation";
import VisitDetails from "../components/VisitDetails";
import { Notice, leadingBody, leadingHeading } from "../ui";

const DAYS_SHOWN = 30;

function daysBefore(date: string, days: number): string {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString().slice(0, 10);
}

function firstLine(text: string): string {
  return text.split("\n")[0];
}

export default function MyVisits({ officerId }: { officerId: string }) {
  const text = useText();
  const to = indiaToday();
  const from = daysBefore(to, DAYS_SHOWN);
  const { data, isPending, isError } = useQuery({
    queryKey: myVisitsQueryKey(officerId, from, to),
    queryFn: () => listVisits({ from, to }),
  });

  const serviceName = (id: number) => {
    const service = services.find((entry) => entry.id === id);
    return service ? text(service.en, service.name) : String(id);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:max-w-3xl">
      <header className="grid gap-1">
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>{text("My visits", "मेरे निरीक्षण")}</h1>
        <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>{text(`Last ${DAYS_SHOWN} days`, `पिछले ${DAYS_SHOWN} दिन`)}</p>
      </header>
      {isPending && <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>{text("Loading…", "लोड हो रहा है…")}</p>}
      {isError && (
        <Notice>
          {text("Could not load your visits. Try again.", "आपके निरीक्षण लोड नहीं हो सके। पुनः प्रयास करें।")}
        </Notice>
      )}
      {data && data.rows.length === 0 && (
        <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>{text("No visits recorded yet.", "अभी कोई निरीक्षण दर्ज नहीं है।")}</p>
      )}
      {data && data.rows.length > 0 && (
        <ul className="grid gap-3">
          {data.rows.map((row: FieldVisitView) => (
            <li
              key={row.id}
              data-testid={`visit-${row.id}`}
              data-voided={row.voidedAt ? "" : undefined}
              className={`grid min-w-0 gap-1 rounded-lg border border-border bg-card p-4 text-[13.5px] ${leadingBody} [overflow-wrap:anywhere] ${row.voidedAt ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              <strong className="font-medium">
                {row.visitDate} · {row.visitTime}
              </strong>
              <span className="text-muted-foreground">
                {text("Anchal", "अंचल")} {row.officeId} · {text("Ward", "वार्ड")} {row.ward}
              </span>
              <span>{serviceName(row.serviceId)}</span>
              <p className="whitespace-pre-wrap">{firstLine(row.issueAction)}</p>
              <VisitDetails serviceId={row.serviceId} details={row.details} />
              <VisitLocation gps={row.gps} ward={row.ward} visitDate={row.visitDate} visitTime={row.visitTime} />
              {row.voidedAt && (
                // Atomic inline: the row's strike-through does not run through the reason.
                <p>
                  <span className="inline-block font-medium text-destructive">
                    {text("Voided", "निरस्त")}: {row.voidReason}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
