import { useContext, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OfficerProfile } from "../../shared/types";
import {
  createOfficer,
  listOfficers,
  resetOfficerPassword,
  setOfficerActive,
  type NewOfficer,
  type OfficerRole,
} from "../officers";
import { Language, runtimeText, useText } from "../i18n";
import { Badge, Button, Field, FieldError, Input, Notice, Panel, Select, confirmBar, focusRing, leadingBody, leadingHeading } from "../ui";
import { normalizeFieldErrors } from "../field-errors";
import { RequestError } from "../api";

const ANCHALS = [1, 2, 3, 4, 5, 6];
// The only two roles the server creates; a commissioner or role manager is seeded, so it is never offered.
const ROLES: OfficerRole[] = ["FieldOfficer", "AnchalOffice"];
const FORM_FIELDS = ["username", "name", "designation", "role", "homeOfficeId"];

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
  const [role, setRole] = useState<OfficerRole>("FieldOfficer");
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
    onError: (error) => {
      // The server names the fields it objected to; put each message on its field.
      // Anything it names that the form has no field for goes in the banner instead,
      // so the generic "correct the highlighted fields" never stands with nothing lit.
      const returned = error instanceof RequestError ? normalizeFieldErrors(error.detail.fieldErrors) : {};
      const onFields = Object.entries(returned).filter(([key]) => FORM_FIELDS.includes(key));
      const elsewhere = Object.entries(returned).filter(([key]) => !FORM_FIELDS.includes(key));
      setErrors(Object.fromEntries(onFields.map(([key, message]) => [key, runtimeText(message, lang)])));
      if (onFields.length > 0 && elsewhere.length === 0) setActionError(null);
      else if (elsewhere.length > 0) setActionError(elsewhere.map(([, message]) => runtimeText(message, lang)).join(" · "));
      else failed(text("Could not add the user. Try again.", "उपयोगकर्ता जोड़ा नहीं जा सका। पुनः प्रयास करें।"))(error);
    },
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
    onError: failed(text("Could not change the user. Try again.", "उपयोगकर्ता नहीं बदला जा सका। पुनः प्रयास करें।")),
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
      role,
      homeOfficeId,
    });
  }

  const roleLabel = (value: string | undefined) =>
    value === "AnchalOffice"
      ? text("Anchal office login", "अंचल कार्यालय लॉगिन")
      : value === "FieldOfficer"
        ? text("Field officer", "क्षेत्रीय अधिकारी")
        : null;
  // An Anchal files through its office login. Deactivating the last active one locks
  // the whole Anchal out, so the confirmation says so at the point of action.
  const lastOfficeLogin = (row: OfficerProfile) =>
    row.role === "AnchalOffice" &&
    !(data ?? []).some((other) => other.id !== row.id && other.active && other.role === "AnchalOffice" && other.homeOfficeId === row.homeOfficeId);
  const cell = `text-[13.5px] ${leadingBody}`;
  // The two confirmations exist so the consequence is read before it is confirmed, so
  // each takes focus when it opens and names that sentence as its description.
  const consequenceId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirming = deactivating?.id ?? resetting?.id ?? null;
  useEffect(() => {
    if (confirming) dialogRef.current?.focus();
  }, [confirming, deactivating !== null]);
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-1.5">
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>{text("User administration", "उपयोगकर्ता प्रबंधन")}</h1>
      </header>

      {actionError && <Notice>{actionError}</Notice>}

      {temporaryPassword && (
        <Notice role="status" className="grid justify-items-start gap-2">
          <p>{text("Temporary password", "अस्थायी पासवर्ड")}</p>
          <p>
            <code className={`font-mono text-lg ${leadingBody} tracking-wider [overflow-wrap:anywhere]`}>{temporaryPassword}</code>
          </p>
          <p>
            {text(
              "Hand this to the user now. It will not be shown again.",
              "यह अभी उपयोगकर्ता को दें। इसे दोबारा नहीं दिखाया जाएगा।",
            )}
          </p>
          <Button type="button" variant="outline" onClick={() => setTemporaryPassword(null)}>
            {text("Dismiss", "बंद करें")}
          </Button>
        </Notice>
      )}

      <Panel className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
        <h2 className={`text-[15px] font-semibold ${leadingHeading} text-foreground sm:col-span-2 lg:col-span-3`}>{text("Add a user", "उपयोगकर्ता जोड़ें")}</h2>
        <Field>
          {text("Role", "भूमिका")}
          <Select value={role} onChange={(e) => setRole(e.target.value as OfficerRole)}>
            {ROLES.map((value) => (
              <option key={value} value={value}>{roleLabel(value)}</option>
            ))}
          </Select>
          {errors.role && <FieldError>{errors.role}</FieldError>}
        </Field>
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
          {role === "AnchalOffice" ? text("Anchal", "अंचल") : text("Home Anchal", "मूल अंचल")}
          <Select value={homeOfficeId} onChange={(e) => setHomeOfficeId(Number(e.target.value))}>
            {ANCHALS.map((id) => (
              <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
            ))}
          </Select>
          {errors.homeOfficeId && <FieldError>{errors.homeOfficeId}</FieldError>}
        </Field>
        <Button
          type="button"
          className="justify-self-start max-sm:justify-self-stretch sm:col-span-2 lg:col-span-3"
          onClick={add}
          disabled={create.isPending}
        >
          {text("Add user", "उपयोगकर्ता जोड़ें")}
        </Button>
      </Panel>

      {isPending && <p className={`${cell} text-muted-foreground`}>{text("Loading…", "लोड हो रहा है…")}</p>}
      {isError && (
        <Notice>{text("Could not load users. Try again.", "उपयोगकर्ता लोड नहीं हो सके। पुनः प्रयास करें।")}</Notice>
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
                {roleLabel(row.role) && <span className={`${cell} text-muted-foreground`}>{roleLabel(row.role)}</span>}
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
        <div ref={dialogRef} tabIndex={-1} className={`${confirmBar} ${focusRing}`} role="dialog" aria-label={text("Reset password", "पासवर्ड रीसेट करें")} aria-describedby={consequenceId}>
          <p id={consequenceId} className={`${cell} text-foreground`}>
            {resetting.role === "AnchalOffice"
              ? text(
                  `${resetting.name} is the office login for Anchal ${resetting.homeOfficeId}. Whoever uses it will not be able to sign in with the current password. Hand them the new one.`,
                  `${resetting.name} अंचल ${resetting.homeOfficeId} का कार्यालय लॉगिन है। इसे उपयोग करने वाले वर्तमान पासवर्ड से लॉगिन नहीं कर सकेंगे। उन्हें नया पासवर्ड दें।`,
                )
              : text(
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
        <div ref={dialogRef} tabIndex={-1} className={`${confirmBar} ${focusRing}`} role="dialog" aria-describedby={consequenceId} aria-label={deactivating.role === "AnchalOffice" ? text("Deactivate office login", "कार्यालय लॉगिन निष्क्रिय करें") : text("Deactivate officer", "अधिकारी निष्क्रिय करें")}>
          {deactivating.role === "AnchalOffice" ? (
            <div className="grid gap-1.5">
              <p id={consequenceId} className={`${cell} font-semibold text-foreground`}>
                {lastOfficeLogin(deactivating)
                  ? text(
                      `This is the only active login for Anchal ${deactivating.homeOfficeId}. Anchal ${deactivating.homeOfficeId} will not be able to file daily entries until it is reactivated.`,
                      `यह अंचल ${deactivating.homeOfficeId} का एकमात्र सक्रिय लॉगिन है। इसके पुनः सक्रिय होने तक अंचल ${deactivating.homeOfficeId} दैनिक प्रविष्टि दर्ज नहीं कर सकेगा।`,
                    )
                  : text(
                      `${deactivating.name} will not be able to sign in. Anchal ${deactivating.homeOfficeId} still has another active login.`,
                      `${deactivating.name} लॉगिन नहीं कर सकेगा। अंचल ${deactivating.homeOfficeId} का एक और सक्रिय लॉगिन है।`,
                    )}
              </p>
              <p className={`${cell} text-foreground`}>{`${deactivating.name} · ${deactivating.username}`}</p>
            </div>
          ) : (
            <p id={consequenceId} className={`${cell} text-foreground`}>
              {text(
                `${deactivating.name} will not be able to sign in or record visits.`,
                `${deactivating.name} न तो लॉगिन कर सकेंगे न निरीक्षण दर्ज कर सकेंगे।`,
              )}
            </p>
          )}
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
