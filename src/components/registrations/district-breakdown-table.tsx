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
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-2 font-medium">Distrikt</th>
            {showRegionColumn ? (
              <th className="pb-2 pr-2 font-medium">Region</th>
            ) : null}
            <th className="pb-2 px-1 text-right font-medium">Reg.</th>
            <th className="pb-2 px-1 text-right font-medium">Andel</th>
            <th className="pb-2 pl-1 text-right font-medium">{brand.shareLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            const focusShare =
              row.count > 0 ? (row.focus_count / row.count) * 100 : 0;

            return (
              <tr
                key={`${row.district}-${row.region ?? "x"}`}
                className="border-b border-border/60"
              >
                <td className="py-2 pr-2 align-top font-medium leading-snug">
                  {row.district}
                </td>
                {showRegionColumn ? (
                  <td className="py-2 pr-2 align-top text-muted-foreground leading-snug">
                    {row.regionLabel ?? "—"}
                  </td>
                ) : null}
                <td className="py-2 px-1 text-right align-top tabular-nums whitespace-nowrap">
                  {formatNumber(row.count)}
                </td>
                <td className="py-2 px-1 text-right align-top tabular-nums whitespace-nowrap text-muted-foreground">
                  {formatPercent(share)} %
                </td>
                <td className="py-2 pl-1 text-right align-top whitespace-nowrap">
                  <div className="font-medium tabular-nums text-volvo-blue">
                    {formatPercent(focusShare, 0)} %
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {formatNumber(row.focus_count)} stk
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-xs font-medium text-muted-foreground">
            <td className="pt-3 pr-2" colSpan={showRegionColumn ? 2 : 1}>
              Totalt
            </td>
            <td className="pt-3 px-1 text-right tabular-nums whitespace-nowrap text-foreground">
              {formatNumber(total)}
            </td>
            <td className="pt-3 px-1 text-right whitespace-nowrap">100 %</td>
            <td className="pt-3 pl-1 text-right whitespace-nowrap">
              <div className="tabular-nums text-volvo-blue">
                {formatPercent(total > 0 ? (focusTotal / total) * 100 : 0, 0)} %
              </div>
              <div className="text-xs tabular-nums">
                {formatNumber(focusTotal)} stk
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
