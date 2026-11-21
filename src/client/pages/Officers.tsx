import { useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OfficerProfile } from "../../shared/types";
import {
  createOfficer,
  listOfficers,
  resetOfficerPassword,
  setOfficerActive,
  type NewOfficer,
} from "../officers";
import { Language, runtimeText, useText } from "../i18n";
import { Badge, Button, Field, FieldError, Input, Notice, Panel, Select, confirmBar, leadingBody, leadingHeading } from "../ui";
import { RequestError } from "../api";

const ANCHALS = [1, 2, 3, 4, 5, 6];

export default function Officers() {
  const text = useText();
  const lang = useContext(Language);
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const failed = (fallback: string) => (error: unknown) =>
    setActionError(
      error instanceof RequestError ? runtimeText(error.detail.message, lang) : fallback,
    );
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [homeOfficeId, setHomeOfficeId] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<OfficerProfile | null>(null);
  const [resetting, setResetting] = useState<OfficerProfile | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["officers"],
    queryFn: listOfficers,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["officers"] });

  const create = useMutation({
    mutationFn: (officer: NewOfficer) => createOfficer(officer),
    onError: failed(text("Could not add the officer. Try again.", "अधिकारी जोड़ा नहीं जा सका। पुनः प्रयास करें।")),
    onSuccess: (result) => {
      setActionError(null);
      setTemporaryPassword(result.temporaryPassword);
      setUsername("");
      setName("");
      setDesignation("");
      refresh();
    },
  });

  const active = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => setOfficerActive(id, next),
    onError: failed(text("Could not change the officer. Try again.", "अधिकारी नहीं बदला जा सका। पुनः प्रयास करें।")),
    onSuccess: () => {
      setActionError(null);
      setDeactivating(null);
      refresh();
    },
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetOfficerPassword(id),
    onError: failed(text("Could not reset the password. Try again.", "पासवर्ड रीसेट नहीं हो सका। पुनः प्रयास करें।")),
    onSuccess: (result) => {
      setActionError(null);
      setResetting(null);
      setTemporaryPassword(result.temporaryPassword);
    },
  });

  function add() {
    const found: Record<string, string> = {};
    if (!username.trim()) found.username = text("Enter a username", "उपयोगकर्ता नाम दर्ज करें");
    if (!name.trim()) found.name = text("Enter the officer's name", "अधिकारी का नाम दर्ज करें");
    if (!designation.trim())
      found.designation = text("Enter a designation", "पदनाम दर्ज करें");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate({
      username: username.trim(),
      name: name.trim(),
      designation: designation.trim(),
      homeOfficeId,
    });
  }

  const cell = `text-[13.5px] ${leadingBody}`;
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-1.5">
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>{text("Field officers", "क्षेत्रीय अधिकारी")}</h1>
      </header>

      {actionError && <Notice>{actionError}</Notice>}

      {temporaryPassword && (
        <Notice role="status" className="grid justify-items-start gap-2">
          <p>{text("Temporary password", "अस्थायी पासवर्ड")}</p>
          <p>
            <code className="font-mono text-lg tracking-wider [overflow-wrap:anywhere]">{temporaryPassword}</code>
          </p>
          <p>
            {text(
              "Hand this to the officer now. It will not be shown again.",
              "यह अभी अधिकारी को दें। इसे दोबारा नहीं दिखाया जाएगा।",
            )}
          </p>
          <Button type="button" variant="outline" onClick={() => setTemporaryPassword(null)}>
            {text("Dismiss", "बंद करें")}
          </Button>
        </Notice>
      )}

      <Panel className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
        <h2 className={`text-[15px] font-semibold ${leadingHeading} text-foreground sm:col-span-2 lg:col-span-4`}>{text("Add an officer", "अधिकारी जोड़ें")}</h2>
        <Field>
          {text("Username", "उपयोगकर्ता नाम")}
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          {errors.username && <FieldError>{errors.username}</FieldError>}
        </Field>
        <Field>
          {text("Name", "नाम")}
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field>
          {text("Designation", "पदनाम")}
          <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          {errors.designation && <FieldError>{errors.designation}</FieldError>}
        </Field>
        <Field>
          {text("Home Anchal", "मूल अंचल")}
          <Select value={homeOfficeId} onChange={(e) => setHomeOfficeId(Number(e.target.value))}>
            {ANCHALS.map((id) => (
              <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          className="justify-self-start max-sm:justify-self-stretch sm:col-span-2 lg:col-span-4"
          onClick={add}
          disabled={create.isPending}
        >
          {text("Add officer", "अधिकारी जोड़ें")}
        </Button>
      </Panel>

      {isPending && <p className={`${cell} text-muted-foreground`}>{text("Loading…", "लोड हो रहा है…")}</p>}
      {isError && (
        <Notice>{text("Could not load officers. Try again.", "अधिकारी लोड नहीं हो सके। पुनः प्रयास करें।")}</Notice>
      )}
      {data && (
        <ul className="grid gap-3">
          {data.map((row) => (
            <li
              key={row.id}
              className={`flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border p-4 ${row.active ? "bg-card" : "bg-muted"}`}
            >
              <div className="grid min-w-0 flex-1 basis-56 gap-0.5 max-sm:basis-full [overflow-wrap:anywhere]">
                <strong className={`${cell} font-medium ${row.active ? "text-foreground" : "text-muted-foreground"}`}>{row.name}</strong>
                <span className={`${cell} text-muted-foreground`}>{row.designation}</span>
              </div>
              <div className="grid min-w-0 gap-0.5 [overflow-wrap:anywhere] max-sm:flex-1 sm:basis-40">
                <span className={`${cell} text-foreground`}>{`${text("Anchal", "अंचल")} ${row.homeOfficeId}`}</span>
                <span className={`font-mono text-[12.5px] ${leadingBody} text-muted-foreground`}>{row.username}</span>
              </div>
              <Badge tone={row.active ? "settled" : "neutral"}>
                {row.active ? text("Active", "सक्रिय") : text("Inactive", "निष्क्रिय")}
              </Badge>
              <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>button]:flex-1">
                {row.active ? (
                  <Button type="button" variant="outline" onClick={() => setDeactivating(row)}>
                    {text("Deactivate", "निष्क्रिय करें")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => active.mutate({ id: row.id, next: true })}>
                    {text("Reactivate", "पुनः सक्रिय करें")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActionError(null);
                    setResetting(row);
                  }}
                >
                  {text("Reset password", "पासवर्ड रीसेट करें")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resetting && (
        <div className={confirmBar} role="dialog" aria-label={text("Reset password", "पासवर्ड रीसेट करें")}>
          <p className={`${cell} text-foreground`}>
            {text(
              `${resetting.name} will not be able to sign in with their current password. Hand them the new one.`,
              `${resetting.name} अपने वर्तमान पासवर्ड से लॉगिन नहीं कर सकेंगे। उन्हें नया पासवर्ड दें।`,
            )}
          </p>
          <div className="grid gap-3 max-sm:w-full sm:flex">
            <Button type="button" onClick={() => reset.mutate(resetting.id)} disabled={reset.isPending}>
              {text("Confirm", "पुष्टि करें")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setResetting(null)}>
              {text("Cancel", "रद्द करें")}
            </Button>
          </div>
        </div>
      )}

      {deactivating && (
        <div className={confirmBar} role="dialog" aria-label={text("Deactivate officer", "अधिकारी निष्क्रिय करें")}>
          <p className={`${cell} text-foreground`}>
            {text(
              `${deactivating.name} will not be able to sign in or record visits.`,
              `${deactivating.name} न तो लॉगिन कर सकेंगे न निरीक्षण दर्ज कर सकेंगे।`,
            )}
          </p>
          <div className="grid gap-3 max-sm:w-full sm:flex">
            <Button type="button" onClick={() => active.mutate({ id: deactivating.id, next: false })}>
              {text("Confirm", "पुष्टि करें")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDeactivating(null)}>
              {text("Cancel", "रद्द करें")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
