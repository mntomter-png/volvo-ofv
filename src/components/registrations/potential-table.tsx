import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  getHpBucketLabel,
  getRegionLabel,
} from "@/lib/ofv/segmentation";
import type {
  PotentialAccountRow,
  PotentialStatus,
} from "@/lib/registrations/potential-queries";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<PotentialStatus, string> = {
  untapped: "Ikke truffet",
  competitor: "Kun konkurrent",
  mixed: "Også konkurrent",
  due: "Forfaller",
  overdue: "Forfalt",
};

function StatusBadge({ status }: { status: PotentialStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "untapped" &&
          "bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-200",
        status === "competitor" &&
          "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200",
        status === "mixed" &&
          "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200",
        status === "due" &&
          "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200",
        status === "overdue" &&
          "bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-200",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function scoreTitle(row: PotentialAccountRow): string {
  return [
    `Fit ${row.fitScore}`,
    `Timing ${row.timingScore}`,
    `Størrelse ${row.sizeScore}`,
  ].join(" · ");
}

export function PotentialTable({
  rows,
  focusMake,
}: {
  rows: PotentialAccountRow[];
  focusMake: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen potensielle kontoer i Volvo-sterke påbygg (≥30 % andel) for
        utvalget.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Bruker</th>
            <th className="pb-2 pr-3 font-medium">Type</th>
            <th className="pb-2 pr-3 font-medium">Anbefalt fit</th>
            <th className="pb-2 pr-3 text-right font-medium">År siden</th>
            <th className="pb-2 pr-3 text-right font-medium">Flåte</th>
            <th className="pb-2 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.partyKey}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="py-2.5 pr-3">
                <div className="font-medium">{row.partyName}</div>
                {row.region != null || row.district ? (
                  <div className="text-xs text-muted-foreground">
                    {[
                      row.region != null ? getRegionLabel(row.region) : null,
                      row.district,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null}
                {row.competitorUnits > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(row.competitorUnits)} konkurrent
                    {row.currentFocus > 0
                      ? ` · ${formatNumber(row.currentFocus)} ${focusMake}`
                      : null}
                  </div>
                ) : null}
              </td>
              <td className="py-2.5 pr-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="py-2.5 pr-3">
                <div className="font-medium">
                  {row.recommendedBodyworkName ?? "–"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    row.recommendedHpBucket != null
                      ? getHpBucketLabel(row.recommendedHpBucket)
                      : null,
                    row.recommendedDriveline,
                    row.bodyworkFocusShare > 0
                      ? `${formatPercent(row.bodyworkFocusShare * 100, 0)} % ${focusMake}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {row.yearsSinceLast != null
                  ? formatNumber(row.yearsSinceLast)
                  : "–"}
                {row.lastFocusDate ? (
                  <div className="text-xs text-muted-foreground">
                    {formatDate(row.lastFocusDate)}
                  </div>
                ) : null}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                <span className="text-foreground">
                  {formatNumber(row.fleetFocus)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  / {formatNumber(row.fleetTotal)}
                </span>
              </td>
              <td
                className="py-2.5 text-right font-medium tabular-nums"
                title={scoreTitle(row)}
              >
                {formatNumber(row.potentialScore)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
