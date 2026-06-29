"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RegionShare } from "@/lib/registrations/queries";

interface RegionTableProps {
  data: RegionShare[];
}

export function RegionTable({ data }: RegionTableProps) {
  const [, startTransition] = useTransition();
  const [region, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions({
      shallow: false,
      clearOnDefault: true,
      startTransition,
    }),
  );
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions({ shallow: false, clearOnDefault: true, startTransition }),
  );

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen regiondata ennå.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);
  const volvoTotal = data.reduce((sum, row) => sum + row.volvo_count, 0);

  const toggleRegion = (value: number) => {
    setPage(null);
    setRegion(region === value ? null : value);
  };

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-muted-foreground">
        Klikk på en region for å filtrere siden.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">Region</th>
            <th className="pb-2 text-right font-medium">Antall</th>
            <th className="pb-2 text-right font-medium">Andel</th>
            <th className="pb-2 text-right font-medium">Volvo</th>
            <th className="pb-2 text-right font-medium">Volvo-andel</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            const volvoShare =
              row.count > 0 ? (row.volvo_count / row.count) * 100 : 0;
            const isActive = region === row.region;
            return (
              <tr
                key={row.region}
                onClick={() => toggleRegion(row.region)}
                className={cn(
                  "cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50",
                  isActive && "bg-primary/5",
                )}
              >
                <td className="py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2",
                      isActive && "font-medium text-volvo-blue",
                    )}
                  >
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-volvo-blue" />
                    )}
                    {row.label}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(row.count)}
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {formatPercent(share)} %
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(row.volvo_count)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-volvo-blue">
                  {formatPercent(volvoShare)} %
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="pt-2">Totalt</td>
            <td className="pt-2 text-right tabular-nums">{formatNumber(total)}</td>
            <td className="pt-2 text-right tabular-nums text-muted-foreground">
              100,0 %
            </td>
            <td className="pt-2 text-right tabular-nums">
              {formatNumber(volvoTotal)}
            </td>
            <td className="pt-2 text-right tabular-nums text-volvo-blue">
              {formatPercent(total > 0 ? (volvoTotal / total) * 100 : 0)} %
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
