import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, leadingBody, leadingHeading } from "../ui";
import { useText } from "../i18n";
import { formatIndiaDateTime } from "../lib/dates";
import AnchalSection from "./dashboard/AnchalSection";
import ServiceSection from "./dashboard/ServiceSection";
import CollectionSection from "./dashboard/CollectionSection";
import TrendSection from "./dashboard/TrendSection";

export default function Dashboard() {
  const t = useText();
  const queryClient = useQueryClient();
  const [updated, setUpdated] = useState("");
  // There is no live feed on the server, so these two are what keep the
  // dashboard current: a poll while the tab is visible, and a refresh on focus.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }, 15000);
    const focus = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", focus);
    };
  }, [queryClient]);

  const eyebrow = `text-[11px] font-medium uppercase tracking-[0.05em] [html[lang=hi]_&]:tracking-normal ${leadingBody} text-muted-foreground`;

  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1.5">
          <div className={eyebrow}>{t("COMMISSIONER REVIEW", "आयुक्त समीक्षा")}</div>
          <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>
            {t("Office monitoring dashboard", "कार्यालय निगरानी डैशबोर्ड")}
          </h1>
          {updated && (
            <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
              {t(
                `Figures as of ${formatIndiaDateTime(updated)}`,
                `आंकड़े ${formatIndiaDateTime(updated)} तक`,
              )}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard"] })}>
          {t("Refresh", "रिफ्रेश")}
        </Button>
      </header>
      <AnchalSection onStamp={setUpdated} />
      <ServiceSection />
      <CollectionSection />
      <TrendSection />
    </div>
  );
}
