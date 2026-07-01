"use client";

import { useBrand } from "@/components/brand/brand-provider";
import { formatNumber, formatPercent } from "@/lib/format";
import type { TopBuyerRow } from "@/lib/registrations/queries";

export function TopBuyersTable({
  buyers,
  countLabel = "Kjøp",
}: {
  buyers: TopBuyerRow[];
  countLabel?: string;
}) {
  const brand = useBrand();

  if (buyers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen kjøpere i utvalget.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Eier</th>
            <th className="pb-2 pr-3 text-right font-medium">{countLabel}</th>
            <th className="pb-2 text-right font-medium">{brand.shortName}</th>
            <th className="pb-2 pl-3 text-right font-medium">Andel</th>
          </tr>
        </thead>
        <tbody>
          {buyers.map((buyer, index) => (
            <tr key={`${buyer.owner_name}-${index}`} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="py-2 pr-3 font-medium">{buyer.owner_name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(buyer.count)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatNumber(buyer.focus_count)}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                {formatPercent(
                  buyer.count > 0 ? (buyer.focus_count / buyer.count) * 100 : 0,
                )}{" "}
                %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
