import { useQuery } from "@tanstack/react-query";
import services from "../../shared/services.json";
import type { FieldVisitView } from "../../shared/types";
import { listVisits } from "../field-visits";
import { indiaToday } from "../lib/dates";
import { myVisitsQueryKey } from "../session-caches";
import { useText } from "../i18n";
import VisitLocation from "../components/VisitLocation";
import { Notice, Panel } from "../ui";

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
    <main id="main-content" tabIndex={-1} className="workspace">
      <Panel>
        <h1>{text("My visits", "मेरे निरीक्षण")}</h1>
        <p>{text(`Last ${DAYS_SHOWN} days`, `पिछले ${DAYS_SHOWN} दिन`)}</p>
        {isPending && <p>{text("Loading…", "लोड हो रहा है…")}</p>}
        {isError && (
          <Notice>
            {text("Could not load your visits. Try again.", "आपके निरीक्षण लोड नहीं हो सके। पुनः प्रयास करें।")}
          </Notice>
        )}
        {data && data.rows.length === 0 && (
          <p>{text("No visits recorded yet.", "अभी कोई निरीक्षण दर्ज नहीं है।")}</p>
        )}
        {data && data.rows.length > 0 && (
          <ul className="visit-list">
            {data.rows.map((row: FieldVisitView) => (
              <li
                key={row.id}
                data-testid={`visit-${row.id}`}
                className={`visit-row ${row.voidedAt ? "is-voided" : ""}`}
              >
                <strong>
                  {row.visitDate} · {row.visitTime}
                </strong>
                <span>
                  {text("Anchal", "अंचल")} {row.officeId} · {text("Ward", "वार्ड")} {row.ward}
                </span>
                <span>{serviceName(row.serviceId)}</span>
                <p>{firstLine(row.issueAction)}</p>
                <VisitLocation gps={row.gps} ward={row.ward} />
                {row.voidedAt && (
                  <span className="visit-void">
                    {text("Voided", "निरस्त")}: {row.voidReason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
