import { formatDate, formatNumber } from "@/lib/format";
import { getRegionLabel } from "@/lib/ofv/segmentation";
import type { OwnerFocusDeclineRow } from "@/lib/registrations/kontoer-queries";

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
        Ingen eiere med fallende {focusMake}-volum i utvalget.
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
            <th className="pb-2 pr-3 text-right font-medium">Region</th>
            <th className="pb-2 pr-3 text-right font-medium">
              {focusMake} nå
            </th>
            <th className="pb-2 pr-3 text-right font-medium">
              {focusMake} i fjor
            </th>
            <th className="pb-2 pr-3 text-right font-medium">Endring</th>
            <th className="pb-2 text-right font-medium">Siste {focusMake}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.ownerKey}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="py-2 pr-3 font-medium">{row.ownerName}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {row.region != null ? getRegionLabel(row.region) : "–"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(row.currentFocus)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(row.priorFocus)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-red-600 dark:text-red-400">
                {row.delta}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {row.lastFocusDate ? formatDate(row.lastFocusDate) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
