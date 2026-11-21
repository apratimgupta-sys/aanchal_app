import { useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import services from "../../shared/services.json";
import type { FieldVisitView } from "../../shared/types";
import { WARD_MAX, WARD_MIN } from "../../domain/visit";
import { listVisits, voidVisit, type VisitFilters } from "../field-visits";
import { listOfficers } from "../officers";
import { RequestError } from "../api";
import { indiaToday } from "../lib/dates";
import { Language, runtimeText, useText } from "../i18n";
import VisitLocation from "../components/VisitLocation";
import { Field, Notice, Panel } from "../ui";

const ANCHALS = [1, 2, 3, 4, 5, 6];
const WARDS = Array.from({ length: WARD_MAX - WARD_MIN + 1 }, (_, i) => WARD_MIN + i);
const DEFAULT_DAYS = 30;
const PAGE_SIZE = 50;

function daysBefore(date: string, days: number): string {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString().slice(0, 10);
}

export default function VisitRegister() {
  const text = useText();
  const lang = useContext(Language);
  const translate = (message: string) => runtimeText(message, lang);
  const queryClient = useQueryClient();
  const today = indiaToday();
  const [filters, setFilters] = useState<VisitFilters>({
    from: daysBefore(today, DEFAULT_DAYS),
    to: today,
  });
  const [page, setPage] = useState(1);
  const [voiding, setVoiding] = useState<FieldVisitView | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  // The dialog renders below a long list, so move focus to it on open.
  useEffect(() => {
    if (voiding) reasonRef.current?.focus();
  }, [voiding]);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["field-visits", "register", filters, page],
    queryFn: () => listVisits({ ...filters, page }),
  });

  const officers = useQuery({ queryKey: ["officers"], queryFn: listOfficers });

  const voidMutation = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => voidVisit(id, why),
    onSuccess: () => {
      setVoiding(null);
      setReason("");
      setVoidError(null);
      void queryClient.invalidateQueries({ queryKey: ["field-visits"] });
    },
    onError: (error) =>
      setVoidError(
        error instanceof RequestError
          ? translate(error.detail.message)
          : text("Could not void this visit. Try again.", "यह निरीक्षण निरस्त नहीं हो सका। पुनः प्रयास करें।"),
      ),
  });

  const serviceName = (id: number) => {
    const service = services.find((entry) => entry.id === id);
    return service ? text(service.en, service.name) : String(id);
  };

  function setFilter(patch: Partial<VisitFilters>) {
    // Any change to the filters invalidates the page the reader was on.
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function confirmVoid() {
    if (!voiding) return;
    if (!reason.trim()) {
      setReasonError(text("Give a reason for voiding this visit", "इस निरीक्षण को निरस्त करने का कारण दें"));
      return;
    }
    setReasonError(null);
    setVoidError(null);
    if (voidMutation.isPending) return;
    voidMutation.mutate({ id: voiding.id, why: reason.trim() });
  }

  return (
    <main id="main-content" tabIndex={-1} className="workspace">
      <Panel>
        <h1>{text("Field visit register", "क्षेत्रीय निरीक्षण रजिस्टर")}</h1>
        <div className="filters">
          <Field>
            {text("From", "से")}
            <input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} />
          </Field>
          <Field>
            {text("To", "तक")}
            <input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} />
          </Field>
          <Field>
            {text("Anchal", "अंचल")}
            <select
              value={filters.officeId ?? ""}
              onChange={(e) => setFilter({ officeId: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              <option value="">{text("All Anchals", "सभी अंचल")}</option>
              {ANCHALS.map((id) => (
                <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
              ))}
            </select>
          </Field>
          <Field>
            {text("Ward", "वार्ड")}
            <select
              value={filters.ward ?? ""}
              onChange={(e) => setFilter({ ward: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              <option value="">{text("All wards", "सभी वार्ड")}</option>
              {WARDS.map((number) => (
                <option key={number} value={number}>{number}</option>
              ))}
            </select>
          </Field>
          <Field>
            {text("Activity", "गतिविधि")}
            <select
              value={filters.serviceId ?? ""}
              onChange={(e) => setFilter({ serviceId: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              <option value="">{text("All activities", "सभी गतिविधियाँ")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {`${String(service.id).padStart(2, "0")} · ${text(service.en, service.name)}`}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            {text("Officer", "अधिकारी")}
            <select
              value={filters.officerId ?? ""}
              onChange={(e) => setFilter({ officerId: e.target.value === "" ? undefined : e.target.value })}
            >
              <option value="">{text("All officers", "सभी अधिकारी")}</option>
              {(officers.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {`${person.name} · ${person.designation}`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isPending && <p>{text("Loading…", "लोड हो रहा है…")}</p>}
        {isError && (
          <Notice>{text("Could not load the register. Try again.", "रजिस्टर लोड नहीं हो सका। पुनः प्रयास करें।")}</Notice>
        )}
        {data && data.rows.length === 0 && (
          <p>{text("No visits for these filters.", "इन फ़िल्टरों के लिए कोई निरीक्षण नहीं।")}</p>
        )}

        {data && data.rows.length > 0 && (
          <p className="visit-count">
            {text(
              `${data.total} visits · page ${page} of ${Math.max(1, Math.ceil(data.total / PAGE_SIZE))}`,
              `${data.total} निरीक्षण · पृष्ठ ${page} / ${Math.max(1, Math.ceil(data.total / PAGE_SIZE))}`,
            )}
          </p>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="visit-paging">
            <button
              type="button"
              className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              {text("Previous", "पिछला")}
            </button>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= Math.ceil(data.total / PAGE_SIZE)}
            >
              {text("Next", "अगला")}
            </button>
          </div>
        )}
        {data && data.rows.length > 0 && (
          <ul className="visit-list">
            {data.rows.map((row) => (
              <li
                key={row.id}
                data-testid={`visit-${row.id}`}
                className={`visit-row ${row.voidedAt ? "is-voided" : ""}`}
              >
                <strong>{row.visitDate} · {row.visitTime}</strong>
                <span>{row.officerName} · {row.officerDesignation}</span>
                <span>
                  {text("Anchal", "अंचल")} {row.officeId} · {text("Ward", "वार्ड")} {row.ward}
                </span>
                <span>{serviceName(row.serviceId)}</span>
                <p>{row.issueAction}</p>
                <VisitLocation gps={row.gps} ward={row.ward} />
                {row.voidedAt ? (
                  <span className="visit-void">{text("Voided", "निरस्त")}: {row.voidReason}</span>
                ) : (
                  <button
                    type="button"
                    className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
                    onClick={() => {
                      setVoiding(row);
                      setReason("");
                      setReasonError(null);
                    }}
                  >
                    {text("Void", "निरस्त करें")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {voiding && (
          <div className="void-dialog" role="dialog" aria-label={text("Void visit", "निरीक्षण निरस्त करें")}>
            <p>
              {text("Voiding keeps the record and marks it struck through.", "निरस्त करने पर अभिलेख बना रहता है और काटकर दिखाया जाता है।")}
            </p>
            <Field>
              {text("Reason", "कारण")}
              <textarea ref={reasonRef} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              {reasonError && <span className="field-error">{reasonError}</span>}
            </Field>
            {voidError && <Notice>{voidError}</Notice>}
            <button
              className="ux4g-btn ux4g-btn-l ux4g-btn-primary"
              type="button"
              onClick={confirmVoid}
              disabled={voidMutation.isPending}
            >
              {text("Confirm void", "निरस्तीकरण पुष्टि करें")}
            </button>
            <button
              className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
              type="button"
              onClick={() => setVoiding(null)}
            >
              {text("Cancel", "रद्द करें")}
            </button>
          </div>
        )}
      </Panel>
    </main>
  );
}
