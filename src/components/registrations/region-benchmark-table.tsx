"use client";

import { useBrand } from "@/components/brand/brand-provider";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RegionBenchmark } from "@/lib/registrations/queries";

export function RegionBenchmarkTable({ data }: { data: RegionBenchmark[] }) {
  const brand = useBrand();

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Region</th>
            <th className="pb-2 pr-3 text-right font-medium">Reg.</th>
            <th className="pb-2 pr-3 text-right font-medium">Andel Norge</th>
            <th className="pb-2 text-right font-medium">{brand.shareLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.region}
              className={cn(
                "border-b border-border/60",
                index === 0 && "bg-volvo-blue/[0.03]",
              )}
            >
              <td className="py-2 pr-3 font-medium">{row.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(row.count)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {formatPercent(row.nationalSharePct)} %
              </td>
              <td className="py-2 text-right tabular-nums">
                <span className="font-medium text-volvo-blue">
                  {formatPercent(row.focusSharePct, 0)} %
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({formatNumber(row.focus_count)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-medium text-muted-foreground">
            <td className="pt-3 pr-3">Totalt</td>
            <td className="pt-3 pr-3 text-right tabular-nums text-foreground">
              {formatNumber(total)}
            </td>
            <td className="pt-3 pr-3 text-right">100 %</td>
            <td className="pt-3 text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
