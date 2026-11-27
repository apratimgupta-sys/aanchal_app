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
import VisitDetails from "../components/VisitDetails";
import { Button, Field, FieldError, Notice, Panel, Table, Td, Th, cardStacked, cardTable, cardTableWrap, cardTitle, confirmBar, leadingBody, leadingHeading, useScrollRegion } from "../ui";

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
  const scrollRegion = useScrollRegion();
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

  const note = `text-[13.5px] ${leadingBody} text-muted-foreground`;
  const heads = [
    text("Date and time", "तिथि और समय"),
    text("Officer", "अधिकारी"),
    text("Anchal and ward", "अंचल और वार्ड"),
    text("Activity", "गतिविधि"),
    text("Issue / Action", "समस्या / कार्रवाई"),
    text("Location", "स्थान"),
    text("Status", "स्थिति"),
  ];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-1.5">
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>{text("Field visit register", "क्षेत्रीय निरीक्षण रजिस्टर")}</h1>
      </header>
      <Panel className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </Panel>

      {isPending && <p className={note}>{text("Loading…", "लोड हो रहा है…")}</p>}
      {isError && (
        <Notice>{text("Could not load the register. Try again.", "रजिस्टर लोड नहीं हो सका। पुनः प्रयास करें।")}</Notice>
      )}
      {data && data.rows.length === 0 && (
        <p className={note}>{text("No visits for these filters.", "इन फ़िल्टरों के लिए कोई निरीक्षण नहीं।")}</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className={`${note} font-mono tabular-nums`}>
            {text(
              `${data.total} visits · page ${page} of ${pages}`,
              `${data.total} निरीक्षण · पृष्ठ ${page} / ${pages}`,
            )}
          </p>
          {data.total > PAGE_SIZE && (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                {text("Previous", "पिछला")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= Math.ceil(data.total / PAGE_SIZE)}
              >
                {text("Next", "अगला")}
              </Button>
            </div>
          )}
        </div>
      )}
      {data && data.rows.length > 0 && (
        <Table
          role="table"
          className={cardTable}
          containerClassName={cardTableWrap}
          containerProps={scrollRegion(text("Field visit register table", "क्षेत्रीय निरीक्षण रजिस्टर तालिका"))}
        >
          <thead role="rowgroup">
            <tr role="row">
              {heads.map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {data.rows.map((row) => (
              <tr
                role="row"
                key={row.id}
                data-testid={`visit-${row.id}`}
                data-voided={row.voidedAt ? "" : undefined}
                className={row.voidedAt ? "text-muted-foreground line-through" : undefined}
              >
                <Td label={heads[0]} className={`${cardTitle} lg:whitespace-nowrap`}>{row.visitDate} · {row.visitTime}</Td>
                <Td label={heads[1]} className="max-lg:grid max-lg:justify-normal max-lg:gap-0.5 lg:min-w-[10rem]">
                  <span className="block font-medium">{row.officerName}</span>
                  <span className="block text-muted-foreground">{row.officerDesignation}</span>
                </Td>
                <Td label={heads[2]} className="lg:whitespace-nowrap">
                  <span>{text("Anchal", "अंचल")} {row.officeId} · {text("Ward", "वार्ड")} {row.ward}</span>
                </Td>
                <Td label={heads[3]} className="lg:min-w-[9rem]">{serviceName(row.serviceId)}</Td>
                <Td label={heads[4]} className={`${cardStacked} lg:min-w-[16rem]`}>
                  <span className="block whitespace-pre-wrap">{row.issueAction}</span>
                  <VisitDetails serviceId={row.serviceId} details={row.details} className="lg:mt-2" />
                </Td>
                <Td label={heads[5]} className={`${cardStacked} lg:grid lg:min-w-[14rem] lg:gap-0.5`}>
                  <VisitLocation gps={row.gps} ward={row.ward} visitDate={row.visitDate} visitTime={row.visitTime} />
                </Td>
                <Td label={heads[6]} className={cardStacked}>
                  {row.voidedAt ? (
                    // Atomic inline: the row's strike-through does not run through the reason.
                    <span className="inline-block font-medium text-destructive">{text("Voided", "निरस्त")}: {row.voidReason}</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-self-start"
                      onClick={() => {
                        setVoiding(row);
                        setReason("");
                        setReasonError(null);
                      }}
                    >
                      {text("Void", "निरस्त करें")}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {voiding && (
        <div className={confirmBar} role="dialog" aria-label={text("Void visit", "निरीक्षण निरस्त करें")}>
          <p className={`text-[13.5px] ${leadingBody} text-foreground`}>
            {text("Voiding keeps the record and marks it struck through.", "निरस्त करने पर अभिलेख बना रहता है और काटकर दिखाया जाता है।")}
          </p>
          <Field className="w-full max-w-xl">
            {text("Reason", "कारण")}
            <textarea ref={reasonRef} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </Field>
          {voidError && <Notice>{voidError}</Notice>}
          <div className="grid gap-3 max-sm:w-full sm:flex">
            <Button type="button" onClick={confirmVoid} disabled={voidMutation.isPending}>
              {text("Confirm void", "निरस्तीकरण पुष्टि करें")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setVoiding(null)}>
              {text("Cancel", "रद्द करें")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
