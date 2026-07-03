"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import { useBrand } from "@/components/brand/brand-provider";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import type { SegmentShare } from "@/lib/dashboard/queries";

interface SegmentTableProps {
  data: SegmentShare[];
  hint?: string;
}

export function SegmentTable({
  data,
  hint = "Klikk på et segment for å filtrere dashbordet.",
}: SegmentTableProps) {
  const brand = useBrand();
  const [, startTransition] = useTransition();
  const [segment, setSegment] = useQueryState("segment", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen segmentdata ennå.</p>;
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);

  const toggleSegment = (name: string) => {
    setSegment(segment === name ? null : name);
  };

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">Segment (oppbygning)</th>
            <th className="pb-2 text-right font-medium">Antall</th>
            <th className="pb-2 text-right font-medium">Andel</th>
            <th className="pb-2 text-right font-medium">{brand.shortName}</th>
            <th className="pb-2 text-right font-medium">{brand.shareLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            const volvoShare =
              row.count > 0 ? (row.volvo_count / row.count) * 100 : 0;
            const isActive = segment === row.segment;
            return (
              <tr
                key={row.segment}
                onClick={() => toggleSegment(row.segment)}
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
                    {row.segment}
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
              {formatNumber(data.reduce((s, r) => s + r.volvo_count, 0))}
            </td>
            <td className="pt-2 text-right tabular-nums text-volvo-blue">
              {formatPercent(
                total > 0
                  ? (data.reduce((s, r) => s + r.volvo_count, 0) / total) * 100
                  : 0,
              )}{" "}
              %
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
