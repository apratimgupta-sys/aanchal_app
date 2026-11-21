// The component layer. Every style here is a Tailwind utility resolved from the
// theme tokens (theme.css via tailwind.config.ts); nothing in this file reads a
// class name from styles.css. Screens that have not been migrated yet import
// from ./legacy-ui instead, and flip to this file when their own task lands.
import { Children, cloneElement, isValidElement, useId, type ComponentProps, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";

// An outline, not a ring: outline-offset leaves a transparent gap, so the focus
// indicator stays visible on a bg-primary button without matching the surface
// behind it. 44px is the touch target and also clears the design's 42px floor.
export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Line heights, with their Hindi counterparts attached. Devanagari matras clip at
// Latin leading, and the element-level `html[lang="hi"] button, label, span ...`
// rule in styles.css used to supply the lift (specificity beats a utility, so these
// tokens were being ignored in Hindi). The lift lives here now, so deleting that
// rule is a no-op. Hindi body/help 1.65 matches what that rule gave; headings get
// 1.5, above their Latin 1.4 but below body because leading shrinks as type grows.
// Unverified in rendered IBM Plex Devanagari: fonts are blocked in the container.
export const leadingBody = "leading-body [html[lang=hi]_&]:leading-[1.65]";
export const leadingHelp = "leading-help [html[lang=hi]_&]:leading-[1.65]";
export const leadingHeading = "leading-heading [html[lang=hi]_&]:leading-[1.5]";

// Why 16px below lg: iOS Safari zooms the whole page when a focused input has a
// font-size under 16px, and the user must pinch back out. Field officers fill these
// forms one-handed on phones, so every control is 16px there and returns to the
// design's 13.5px at lg, where nothing zooms. A system-wide default, not a per-screen
// exception; it departs from the mockups (15px) and the spec's 13.5px on purpose.
const control = cva(
  [
    `block min-h-[44px] min-w-0 rounded-[7px] border border-input bg-card px-3 py-[10px] text-[16px] lg:text-[13.5px] ${leadingBody} text-foreground`,
    "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
    "aria-[invalid=true]:border-destructive",
    focusRing,
  ],
  {
    variants: {
      // A figure is sized to its content, not stretched to the container.
      width: {
        full: "w-full",
        count: "w-[84px] text-right font-mono tabular-nums",
        money: "w-[118px] text-right font-mono tabular-nums",
      },
    },
    defaultVariants: { width: "full" },
  },
);

type ControlProps = VariantProps<typeof control>;

export function Input({ width, className, ...props }: Omit<ComponentProps<"input">, "width"> & ControlProps) {
  return <input {...props} className={cn(control({ width }), className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(control(), className)} />;
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn(`block text-xs ${leadingHelp} text-destructive`, className)} />;
}

const isControl = (c: unknown): c is ReactElement<Record<string, unknown>> =>
  isValidElement(c) && (["input", "textarea", "select"].includes(String(c.type)) || c.type === Input || c.type === Select);

/**
 * A label above its control, 6px apart. Two ways in, both kept:
 *   <Field>Label text<input /><FieldError>…</FieldError></Field>   (label is the leading children)
 *   <Field label="Label text" htmlFor="id"><Input id="id" /></Field>
 * Anything after the control is help text; a FieldError among it marks the
 * control invalid and is announced through aria-describedby.
 */
export function Field({ children, className, label, htmlFor }: { children: ReactNode; className?: string; label?: ReactNode; htmlFor?: string }) {
  const generatedId = useId();
  const parts = Children.toArray(children).filter((c) => typeof c !== "string" || c.trim());
  const index = parts.findIndex(isControl);
  if (index < 0) return <div className={className}>{children}</div>;
  const el = parts[index] as ReactElement<Record<string, unknown> & { className?: string }>;
  const id = String(htmlFor ?? el.props.id ?? generatedId);
  const labelParts = label !== undefined ? [label] : parts.slice(0, index);
  const before = label !== undefined ? parts.slice(0, index) : [];
  const helpers = parts.slice(index + 1);
  const error = helpers.some((c) => isValidElement(c) && c.type === FieldError);
  const helpId = `${id}-help`;
  const raw = typeof el.type === "string";
  const accessible = cloneElement(el, {
    id,
    // A bare <input>/<select> is styled here; Input/Select style themselves.
    className: raw && el.props.type !== "checkbox" ? cn(control(), el.type === "textarea" && "min-h-24 resize-y", el.props.className) : el.props.className,
    "aria-invalid": error || undefined,
    "aria-describedby": helpers.length ? [el.props["aria-describedby"], helpId].filter(Boolean).join(" ") : el.props["aria-describedby"],
  });
  if (el.props.type === "checkbox") {
    return (
      <label className={cn(`flex min-h-[44px] cursor-pointer items-start gap-2.5 text-[13.5px] ${leadingBody}`, className)}>
        {cloneElement(el, { id, className: "mt-[3px] size-[18px] shrink-0 accent-primary" })}
        <span>{labelParts}{helpers}</span>
      </label>
    );
  }
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className={`text-[11px] font-medium ${leadingBody} text-muted-foreground`}>
        {labelParts}
        {Boolean(el.props.required) && <span aria-hidden="true"> *</span>}
      </label>
      {before}
      {accessible}
      {helpers.length > 0 && (
        <div id={helpId} className={cn(`text-xs ${leadingHelp}`, error ? "text-destructive" : "text-muted-foreground")}>
          {helpers}
        </div>
      )}
    </div>
  );
}

const button = cva(
  [
    `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[7px] border px-4 py-2.5 text-center text-[13.5px] font-medium ${leadingBody}`,
    "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    focusRing,
  ],
  {
    variants: {
      variant: {
        // Hover darkens toward the foreground token rather than hard-coding a shade.
        primary: "border-transparent bg-primary text-primary-foreground enabled:hover:bg-[color-mix(in_srgb,hsl(var(--primary)),hsl(var(--foreground))_40%)]",
        outline: "border-input bg-card text-foreground enabled:hover:bg-muted",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({ variant, className, ...props }: ComponentProps<"button"> & VariantProps<typeof button>) {
  return <button {...props} className={cn(button({ variant }), className)} />;
}

export function Panel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={cn("min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-6", className)}>
      {children}
    </section>
  );
}
export const Card = Panel;

const notice = cva(`rounded-[7px] border border-l-4 px-4 py-3 text-[13.5px] ${leadingBody} text-foreground`, {
  variants: {
    tone: {
      error: "border-destructive/35 border-l-destructive bg-destructive/[0.07]",
      success: "border-success/35 border-l-success bg-success/[0.08]",
    },
  },
});

export function Notice({ children, className, role = "alert", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} role={role} className={notice({ tone: role === "status" ? "success" : "error" })}>
      <div className={className}>{children}</div>
    </div>
  );
}

// Status colours are reserved for state, and every tone carries its text.
const badge = cva(`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${leadingBody}`, {
  variants: {
    tone: {
      neutral: "border-border bg-muted text-muted-foreground",
      settled: "border-accent-foreground/25 bg-accent text-accent-foreground",
      attention: "border-warning/30 bg-warning-foreground text-warning",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ tone, className, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span {...props} className={cn(badge({ tone }), className)} />;
}

/** Wide tables scroll inside this container; the page never does. Devanagari
 *  takes no letter-spacing, so the header tracking is dropped under lang="hi".
 *  `data-scroll-x` marks the container for tests and tooling. `containerProps` and
 *  `containerClassName` reach the wrapper, which is where a scroll region's
 *  label and tabIndex belong. */
export function Table({
  className,
  children,
  containerClassName,
  containerProps,
  ...props
}: ComponentProps<"table"> & { containerClassName?: string; containerProps?: HTMLAttributes<HTMLDivElement> }) {
  return (
    <div {...containerProps} data-scroll-x="" className={cn("overflow-x-auto rounded-lg border border-border bg-card", containerClassName)}>
      <table
        {...props}
        className={cn(
          `w-full border-collapse text-left text-[13.5px] ${leadingBody}`,
          "[&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-muted-foreground",
          "[html[lang=hi]_&_th]:tracking-normal",
          "[&_td]:px-4 [&_td]:py-3 [&_tbody_tr+tr]:border-t [&_tbody_tr+tr]:border-border/60",
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function ReportProgress({ value, max }: { value: number; max: number }) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground" role="progressbar" aria-label="Services submitted" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

// Wide tables below lg: each row becomes a card and every cell carries its own header
// through data-label, so no column is dropped; at lg and up it is an ordinary table that
// scrolls inside its own container. One DOM serves both. Pass `role="table"` on <Table>
// and use <Th>/<Td> so the explicit roles keep the table semantics that
// display:block/grid would otherwise strip in Safari. Same treatment as the dashboard's.
export const cardTable = [
  "max-lg:block max-lg:[&_thead]:sr-only",
  "max-lg:[&_tbody]:grid max-lg:[&_tbody]:gap-3 max-lg:[&_tfoot]:grid max-lg:[&_tfoot]:mt-3",
  "max-lg:[&_tr]:grid max-lg:[&_tr]:gap-y-2 max-lg:[&_tr]:rounded-lg max-lg:[&_tr]:border max-lg:[&_tr]:border-border max-lg:[&_tr]:bg-card max-lg:[&_tr]:p-4",
  "max-lg:[&_tbody_tr+tr]:border-border max-lg:[&_td]:p-0 max-lg:[&_tfoot_tr]:bg-muted",
  "[&_td]:align-top",
].join(" ");
export const cardTableWrap = "max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent";
const cardCell = [
  "max-lg:flex max-lg:items-baseline max-lg:justify-between max-lg:gap-4 max-lg:[overflow-wrap:anywhere]",
  "max-lg:before:shrink-0 max-lg:before:content-[attr(data-label)] max-lg:before:text-[11px] max-lg:before:font-medium max-lg:before:font-sans max-lg:before:text-left max-lg:before:text-muted-foreground",
].join(" ");
/** A cell's own value as the card's heading: label hidden, value first. */
export const cardTitle = "max-lg:block max-lg:before:hidden max-lg:font-medium";
/** Label above value instead of beside it, for long or multi-part values. */
export const cardStacked = "max-lg:grid max-lg:justify-normal max-lg:gap-0.5";

export function Td({ label, className, children, ...props }: Omit<ComponentProps<"td">, "label"> & { label: string }) {
  return (
    <td {...props} role="cell" data-label={label} className={cn(cardCell, className)}>
      {children}
    </td>
  );
}
export function Th({ className, children, ...props }: ComponentProps<"th">) {
  return (
    <th {...props} role="columnheader" scope="col" className={cn("text-left", className)}>
      {children}
    </th>
  );
}

/** The sticky confirmation bar a destructive action asks in, at the foot of its panel. */
export const confirmBar =
  "sticky bottom-0 z-10 mt-1 grid justify-items-start gap-3 rounded-lg border-2 border-primary bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg";
