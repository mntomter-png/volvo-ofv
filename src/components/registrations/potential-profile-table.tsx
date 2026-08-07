"use client";

import { useTransition } from "react";
import { parseAsInteger, useQueryState } from "nuqs";

import { formatNumber, formatPercent } from "@/lib/format";
import { getHpBucketLabel } from "@/lib/ofv/segmentation";
import type { PotentialBodyworkProfile } from "@/lib/registrations/potential-queries";
import { cn } from "@/lib/utils";

export function PotentialProfileTable({
  profile,
  focusMake,
}: {
  profile: PotentialBodyworkProfile[];
  focusMake: string;
}) {
  const [, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };
  const [bodywork, setBodywork] = useQueryState(
    "bodywork",
    parseAsInteger.withOptions(nuqsOptions),
  );

  function toggle(code: number) {
    setBodywork(bodywork === code ? null : code);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Klikk på et påbygg for å vise potensielle kunder i handlingslisten under.
        Klikk igjen for å fjerne filteret.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Påbygg</th>
              <th className="pb-2 pr-3 text-right font-medium">Volum</th>
              <th className="pb-2 pr-3 text-right font-medium">{focusMake} %</th>
              <th className="pb-2 pr-3 text-right font-medium">El %</th>
              <th className="pb-2 font-medium">HK-fit</th>
            </tr>
          </thead>
          <tbody>
            {profile.map((row) => {
              const isActive = bodywork === row.bodyworkCode;
              return (
                <tr
                  key={row.bodyworkCode}
                  onClick={() => toggle(row.bodyworkCode)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(row.bodyworkCode);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  className={cn(
                    "cursor-pointer border-b border-border/60 last:border-0 transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                    isActive && "bg-volvo-blue/[0.06]",
                  )}
                >
                  <td
                    className={cn(
                      "py-2 pr-3 font-medium",
                      isActive && "font-semibold text-volvo-blue",
                    )}
                  >
                    {row.bodyworkName}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatNumber(row.total)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatPercent(row.focusShare * 100, 0)} %
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatPercent(row.emobShare * 100, 0)} %
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {row.fitHpBucket != null
                      ? `${getHpBucketLabel(row.fitHpBucket)} (${formatPercent(row.fitHpFocusShare * 100, 0)} %)`
                      : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
