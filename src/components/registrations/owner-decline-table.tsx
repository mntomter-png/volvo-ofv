import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getRegionLabel } from "@/lib/ofv/segmentation";
import type {
  OwnerDeclineStatus,
  OwnerFocusDeclineRow,
} from "@/lib/registrations/kontoer-queries";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OwnerDeclineStatus, string> = {
  competitor: "Byttet merke",
  dormant: "Ingen kjøp",
  reduced: "Redusert",
};

function scoreTitle(row: OwnerFocusDeclineRow): string {
  return [
    `Tapte enheter ${row.volumeScore}`,
    `Konkurrent/status ${row.shareScore}`,
    `Tid siden siste ${row.recencyScore}`,
  ].join(" · ");
}

function StatusBadge({ status }: { status: OwnerDeclineStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "competitor" &&
          "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200",
        status === "dormant" && "bg-muted text-muted-foreground",
        status === "reduced" &&
          "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OwnerDeclineTable({
  rows,
  focusMake,
}: {
  rows: OwnerFocusDeclineRow[];
  focusMake: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen eiere med minst 2 {focusMake}-kjøp i fjor og fallende volum nå.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Eier</th>
            <th className="pb-2 pr-3 font-medium">Signal</th>
            <th className="pb-2 pr-3 text-right font-medium">
              {focusMake}
            </th>
            <th className="pb-2 pr-3 text-right font-medium">Tapt</th>
            <th className="pb-2 pr-3 text-right font-medium">Share</th>
            <th className="pb-2 pr-3 text-right font-medium">Score</th>
            <th className="pb-2 text-right font-medium">Siste</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const lost = row.priorFocus - row.currentFocus;
            const shareLabel =
              row.priorSharePct == null
                ? "–"
                : row.currentSharePct == null
                  ? `– (var ${formatPercent(row.priorSharePct)} %)`
                  : `${formatPercent(row.currentSharePct)} % ← ${formatPercent(row.priorSharePct)} %`;

            return (
              <tr
                key={row.ownerKey}
                className="border-b border-border/60 last:border-0"
              >
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{row.ownerName}</div>
                  {row.region != null ? (
                    <div className="text-xs text-muted-foreground">
                      {getRegionLabel(row.region)}
                      {row.status === "competitor" && row.competitorUnits > 0
                        ? ` · ${formatNumber(row.competitorUnits)} konkurrent`
                        : null}
                    </div>
                  ) : row.status === "competitor" &&
                    row.competitorUnits > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(row.competitorUnits)} konkurrentkjøp i
                      perioden
                    </div>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  <span className="text-foreground">
                    {formatNumber(row.currentFocus)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatNumber(row.priorFocus)}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-medium">
                  −{formatNumber(lost)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                  {shareLabel}
                </td>
                <td
                  className="py-2.5 pr-3 text-right tabular-nums font-semibold"
                  title={scoreTitle(row)}
                >
                  {formatNumber(row.priorityScore)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {row.lastFocusDate ? formatDate(row.lastFocusDate) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
