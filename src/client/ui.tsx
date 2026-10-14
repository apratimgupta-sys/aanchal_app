import { Children, cloneElement, isValidElement, useId, type HTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input ${props.className ?? ""}`} />;
}

export function Field({ children, className = "" }: { children: ReactNode; className?: string }) {
  const generatedId = useId();
  const parts = Children.toArray(children).filter((c) => typeof c !== "string" || c.trim());
  const index = parts.findIndex((c) => isValidElement(c) && ["input", "textarea", "select"].includes(String(c.type)));
  if (index < 0) return <div className={className}>{children}</div>;
  const control = parts[index] as ReactElement<Record<string, unknown>>;
  const id = String(control.props.id ?? generatedId);
  const label = parts.filter((_, i) => i < index);
  const helpers = parts.slice(index + 1);
  const error = helpers.some((c) => isValidElement<{ className?: string }>(c) && c.props.className?.includes("field-error"));
  const family = control.type === "textarea" ? "textarea" : control.type === "select" ? "select" : "input";
  const helpId = `${id}-help`;
  const accessibleControl = cloneElement(control, {
    id,
    className: `ui-${family} ${error ? "is-error" : ""} ${control.props.className ?? ""}`,
    "aria-invalid": error || undefined,
    "aria-describedby": helpers.length ? [control.props["aria-describedby"], helpId].filter(Boolean).join(" ") : control.props["aria-describedby"],
  });
  if (control.props.type === "checkbox") return <label className={`ui-checkbox ${className}`}>{cloneElement(control, { id, className: "ui-checkbox-control" })}<span>{label}{helpers}</span></label>;
  return <div className={`ui-field ${className}`}><label htmlFor={id}>{label}{Boolean(control.props.required) && <span aria-hidden="true"> *</span>}</label>{accessibleControl}{helpers.length > 0 && <div id={helpId} className={`ui-help ${error ? "ui-error" : ""}`}>{helpers}</div>}</div>;
}

export function Panel({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`ui-card ${className}`}><div className="ui-card-body">{children}</div></section>;
}

export function Notice({ children, className = "", role = "alert", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} role={role} className={`ui-alert ${role === "status" ? "ui-alert-success" : "ui-alert-error"}`}><div className={className}>{children}</div></div>;
}

export function ReportProgress({ value, max }: { value: number; max: number }) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return <div className="ui-progress" role="progressbar" aria-label="Services submitted" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><div className="ui-progress-track"><div className="ui-progress-fill" style={{ width: `${percent}%` }} /></div><span>{percent}%</span></div>;
}
