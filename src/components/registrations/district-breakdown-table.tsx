"use client";

import { useBrand } from "@/components/brand/brand-provider";
import { formatNumber, formatPercent } from "@/lib/format";
import type { DistrictShare } from "@/lib/registrations/queries";

export function DistrictBreakdownTable({
  data,
  showRegionColumn,
}: {
  data: DistrictShare[];
  showRegionColumn: boolean;
}) {
  const brand = useBrand();

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);
  const focusTotal = data.reduce((sum, row) => sum + row.focus_count, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Distrikt</th>
            {showRegionColumn ? (
              <th className="pb-2 pr-3 font-medium">Region</th>
            ) : null}
            <th className="pb-2 pr-3 text-right font-medium">Reg.</th>
            <th className="pb-2 pr-3 text-right font-medium">Andel</th>
            <th className="pb-2 text-right font-medium">{brand.shortName}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            const focusShare =
              row.count > 0 ? (row.focus_count / row.count) * 100 : 0;

            return (
              <tr key={`${row.district}-${row.region ?? "x"}`} className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">{row.district}</td>
                {showRegionColumn ? (
                  <td className="py-2 pr-3 text-muted-foreground">
                    {row.regionLabel ?? "—"}
                  </td>
                ) : null}
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(row.count)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {formatPercent(share)} %
                </td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-medium text-volvo-blue">
                    {formatPercent(focusShare, 0)} %
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({formatNumber(row.focus_count)})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-xs font-medium text-muted-foreground">
            <td className="pt-3 pr-3" colSpan={showRegionColumn ? 2 : 1}>
              Totalt
            </td>
            <td className="pt-3 pr-3 text-right tabular-nums text-foreground">
              {formatNumber(total)}
            </td>
            <td className="pt-3 pr-3 text-right">100 %</td>
            <td className="pt-3 text-right tabular-nums">
              {formatNumber(focusTotal)} ·{" "}
              <span className="text-volvo-blue">
                {formatPercent(total > 0 ? (focusTotal / total) * 100 : 0, 0)} %
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
