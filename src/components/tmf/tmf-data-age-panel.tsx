import { TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TmfDataAgeReport } from "@/lib/tmf/data-age";
import { cn } from "@/lib/utils";

interface TmfDataAgeStats {
  lastSsbSyncLabel: string;
  indicatorCount: number;
  renewalMonthCount: number;
  seasonalityLabel: string;
  nextYearLabel: string;
}

export function TmfDataAgeBanner({ report }: { report: TmfDataAgeReport }) {
  if (report.warnings.length === 0) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
      role="alert"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-2">
        <p className="font-medium">Datagrunnlaget er utdatert</p>
        <ul className="list-disc space-y-1 pl-4">
          {report.warnings.map((warning) => (
            <li key={warning.id}>{warning.detail ?? `${warning.label}: ${warning.ageLabel}`}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TmfDataAgeCard({
  report,
  stats,
}: {
  report: TmfDataAgeReport;
  stats: TmfDataAgeStats;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datagrunnlag</CardTitle>
        <CardDescription>
          Alder på tallene prognosen bygger på. OFV-data eldre enn 3 dager,
          ordre- og tilbudstall eldre enn 45 dager, og SSB-serier som ligger
          klart bak de andre, varsles over.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Siste SSB-synk" value={stats.lastSsbSyncLabel} />
          <Stat label="SSB-datapunkter" value={stats.indicatorCount.toLocaleString("nb-NO")} />
          <Stat label="Fornyelses-snapshots" value={`${stats.renewalMonthCount}/12 mnd`} />
          <Stat label="Sesongkalibrering" value={stats.seasonalityLabel} />
          <Stat label="Neste år" value={stats.nextYearLabel} />
        </div>

        <ul className="divide-y divide-border/60">
          {report.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p
                  className={cn(
                    "text-sm tabular-nums",
                    item.status === "warn"
                      ? "font-medium text-amber-800 dark:text-amber-200"
                      : "text-muted-foreground",
                  )}
                >
                  {item.status === "warn" ? "Advarsel · " : ""}
                  {item.ageLabel}
                </p>
              </div>
              {item.detail ? (
                <p
                  className={cn(
                    "text-xs",
                    item.status === "warn"
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-muted-foreground",
                  )}
                >
                  {item.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
