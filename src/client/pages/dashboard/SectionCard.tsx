import type { ReactNode } from "react";
import { Notice, Panel, leadingBody, leadingHeading, leadingHelp } from "../../ui";

export default function SectionCard({
  id,
  title,
  subtitle,
  aside,
  filters,
  error,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  filters: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Panel aria-labelledby={`${id}-heading`} className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-1">
          <h2 id={`${id}-heading`} className={`text-[15px] font-semibold ${leadingHeading} text-foreground`}>
            {title}
          </h2>
          {subtitle && <p className={`text-[13px] ${leadingHelp} text-muted-foreground`}>{subtitle}</p>}
        </div>
        {aside && <div className={`${leadingBody} text-[13px]`}>{aside}</div>}
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border pb-4">{filters}</div>
      {error && <Notice>{error}</Notice>}
      {children}
    </Panel>
  );
}
