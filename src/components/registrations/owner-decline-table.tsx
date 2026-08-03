import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getRegionLabel } from "@/lib/ofv/segmentation";
import type {
  OwnerDeclineStatus,
  OwnerFocusDeclineRow,
} from "@/lib/registrations/kontoer-queries";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OwnerDeclineStatus, string> = {
  competitor: "Kun konkurrent",
  mixed: "Også konkurrent",
  due: "Forfaller",
  overdue: "Forfalt",
  ok: "Aktiv",
};

function scoreTitle(row: OwnerFocusDeclineRow): string {
  return [
    `Størrelse ${row.sizeScore}`,
    `Signal ${row.signalScore}`,
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
        status === "mixed" &&
          "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200",
        status === "due" &&
          "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200",
        status === "overdue" &&
          "bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-200",
        status === "ok" && "bg-muted text-muted-foreground",
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
        Ingen kontoer med konkurrentkjøp eller forfall i utvalget (minst 2{" "}
        {focusMake}-kjøp siste 10 år, og ≥3 år siden siste — eller
        konkurrentkjøp i perioden).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Eier</th>
            <th className="pb-2 pr-3 font-medium">Signal</th>
            <th className="pb-2 pr-3 text-right font-medium">
              {focusMake} 10 år
            </th>
            <th className="pb-2 pr-3 text-right font-medium">I perioden</th>
            <th className="pb-2 pr-3 text-right font-medium">År siden</th>
            <th className="pb-2 pr-3 text-right font-medium">Score</th>
            <th className="pb-2 text-right font-medium">Siste</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {formatNumber(row.focus10y)}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(row.currentFocus)} {focusMake}
                {row.competitorUnits > 0
                  ? ` · ${formatNumber(row.competitorUnits)} andre`
                  : null}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-medium">
                {formatPercent(row.yearsSinceLast)}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
