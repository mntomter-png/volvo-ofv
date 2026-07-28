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
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-2 font-medium">Region</th>
            <th className="pb-2 px-1 text-right font-medium">Reg.</th>
            <th className="pb-2 px-1 text-right font-medium">Andel</th>
            <th className="pb-2 pl-1 text-right font-medium">{brand.shareLabel}</th>
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
              <td className="py-2 pr-2 align-top font-medium leading-snug">
                <span className="line-clamp-2" title={row.label}>
                  {row.label}
                </span>
              </td>
              <td className="py-2 px-1 text-right align-top tabular-nums whitespace-nowrap">
                {formatNumber(row.count)}
              </td>
              <td className="py-2 px-1 text-right align-top tabular-nums whitespace-nowrap text-muted-foreground">
                {formatPercent(row.nationalSharePct)} %
              </td>
              <td className="py-2 pl-1 text-right align-top whitespace-nowrap">
                <div className="font-medium tabular-nums text-volvo-blue">
                  {formatPercent(row.focusSharePct, 0)} %
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {formatNumber(row.focus_count)} stk
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-medium text-muted-foreground">
            <td className="pt-3 pr-2">Totalt</td>
            <td className="pt-3 px-1 text-right tabular-nums whitespace-nowrap text-foreground">
              {formatNumber(total)}
            </td>
            <td className="pt-3 px-1 text-right whitespace-nowrap">100 %</td>
            <td className="pt-3 pl-1 text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
