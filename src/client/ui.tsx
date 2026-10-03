import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

/** Application adapters preserve UX4G's standard DOM contract and React state ownership. */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ux4g-input-container ux4g-input-l ux4g-input-default">
      <div
        onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
        className={`ux4g-input${props.disabled ? " ux4g-input-is-disabled" : ""}`}
      >
        <input
          {...props}
          className={`ux4g-input-input ${props.className ?? ""}`}
        />
      </div>
    </div>
  );
}

export function Field({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const parts = Children.toArray(children).filter(
    (c) => typeof c !== "string" || c.trim(),
  );
  const index = parts.findIndex(
    (c) =>
      isValidElement(c) &&
      ["input", "textarea", "select"].includes(String(c.type)),
  );
  if (index < 0) return <div className={className}>{children}</div>;
  const control = parts[index] as ReactElement<Record<string, unknown>>;
  const id = String(control.props.id ?? generatedId);
  const label = parts.filter((_, i) => i < index);
  // The confirmation checkbox puts its label after the control.
  if (control.props.type === "checkbox")
    return (
      <label
        className={`ux4g-checkbox ux4g-checkbox-m ux4g-min-h-48 ${className}`}
      >
        {cloneElement(control, { id, className: "ux4g-checkbox-input" })}
        <span className="ux4g-checkbox-control">
          <span className="ux4g-checkmark" />
        </span>
        <span className="ux4g-checkbox-content">
          <span className="ux4g-checkbox-header">
            <span className="ux4g-checkbox-label">
              {label}
              {parts.slice(index + 1)}
            </span>
          </span>
        </span>
      </label>
    );
  const helpers = parts.slice(index + 1);
  const error = helpers.some(
    (c) =>
      isValidElement<{ className?: string }>(c) &&
      c.props.className?.includes("field-error"),
  );
  const family = control.type === "textarea" ? "textarea" : "input";
  const select = control.type === "select";
  const helpId = `${id}-help`;
  const accessibleControl = cloneElement(control, {
    id,
    className: select
      ? "ux4g-form-select ux4g-form-select-l"
      : `ux4g-${family}-input`,
    "aria-invalid": error || undefined,
    "aria-describedby": helpers.length
      ? [control.props["aria-describedby"], helpId].filter(Boolean).join(" ")
      : control.props["aria-describedby"],
  });
  return (
    <div
      className={`${className} ux4g-${family}-container ux4g-${family}-l ux4g-${family}-${error ? "error" : "default"}`}
    >
      <label className="ux4g-label-l-default" htmlFor={id}>
        {label}
      </label>
      {select ? (
        accessibleControl
      ) : (
        <div
          onClick={(event) =>
            event.currentTarget.querySelector("input,textarea")?.isConnected &&
            (
              event.currentTarget.querySelector("input,textarea") as HTMLElement
            ).focus()
          }
          className={`ux4g-${family}${control.props.disabled ? ` ux4g-${family}-is-disabled` : ""}`}
        >
          {accessibleControl}
        </div>
      )}
      {helpers.length > 0 && (
        <div id={helpId} className={`ux4g-${family}-helper`}>
          <span className={`ux4g-${family}-helper-text`}>{helpers}</span>
        </div>
      )}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  const flush = className.includes("service-list");
  const layout = className.includes("filters")
    ? "ux4g-d-flex ux4g-flex-wrap ux4g-ai-end ux4g-gap-x-l ux4g-gap-y-l"
    : className.includes("report-toolbar")
      ? "ux4g-d-flex ux4g-flex-wrap ux4g-ai-center ux4g-gap-xl"
      : "";
  return (
    <section
      {...props}
      className={`ux4g-card ux4g-card-outline ux4g-card-vertical ux4g-bg-neutral-elevated ${className}`}
    >
      <div
        className={`ux4g-card-body ${layout} ${flush ? "ux4g-p-none" : "ux4g-p-xl"}`}
      >
        {children}
      </div>
    </section>
  );
}

export function Notice({
  children,
  className = "",
  role = "alert",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      role={role}
      className={`ux4g-alert ux4g-context-alert ux4g-alert-${role === "status" ? "success" : "error"} ${className}`}
    >
      <div className="ux4g-alert-content">
        <div className="ux4g-alert-message">{children}</div>
      </div>
    </div>
  );
}

export function ReportProgress({ value, max }: { value: number; max: number }) {
  const percent = Math.round((value / max) * 100);
  return (
    <div
      className="ux4g-progress-bar"
      data-ux-shape="sharp"
      data-ux-label-placement="outside"
      role="progressbar"
      aria-label="Services submitted"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="ux4g-progress-bar-track">
        <div
          className="ux4g-progress-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="ux4g-label-s-strong">{percent}%</span>
    </div>
  );
}
