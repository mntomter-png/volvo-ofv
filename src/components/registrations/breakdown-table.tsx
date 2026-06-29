"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";

export interface BreakdownRow {
  /** Nøkkel (som streng) som lagres i URL-en, f.eks. "1" eller "Elektrisitet". */
  key: string;
  label: string;
  count: number;
  volvo_count: number;
}

interface BreakdownTableProps {
  /** URL-parameter som styrer filteret (f.eks. "region", "hp" eller "fuel"). */
  queryKey: string;
  /** Kolonneoverskrift for nøkkel-kolonnen. */
  columnLabel: string;
  hint: string;
  data: BreakdownRow[];
}

export function BreakdownTable({
  queryKey,
  columnLabel,
  hint,
  data,
}: BreakdownTableProps) {
  const [, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };
  const [active, setActive] = useQueryState(queryKey, nuqsOptions);
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(nuqsOptions),
  );

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);
  const volvoTotal = data.reduce((sum, row) => sum + row.volvo_count, 0);

  const toggle = (key: string) => {
    setPage(null);
    setActive(active === key ? null : key);
  };

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">{columnLabel}</th>
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
            const isActive = active === row.key;
            return (
              <tr
                key={row.key}
                onClick={() => toggle(row.key)}
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
