"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import { useBrand } from "@/components/brand/brand-provider";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  volvo_count: number;
}

interface BreakdownTableProps {
  queryKey: string;
  columnLabel: string;
  hint: string;
  data: BreakdownRow[];
  /** Scrollbar liste slik at kortet ikke vokser forbi nabokort. */
  scrollable?: boolean;
}

export function BreakdownTable({
  queryKey,
  hint,
  data,
  scrollable = false,
}: BreakdownTableProps) {
  const brand = useBrand();
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
  const focusTotal = data.reduce((sum, row) => sum + row.volvo_count, 0);
  const focusTotalShare = total > 0 ? (focusTotal / total) * 100 : 0;

  const toggle = (key: string) => {
    setPage(null);
    setActive(active === key ? null : key);
  };

  return (
    <div
      className={cn(
        scrollable && "flex max-h-[22rem] flex-col sm:max-h-[24rem]",
      )}
    >
      <p className="mb-3 shrink-0 text-xs text-muted-foreground">{hint}</p>

      <ul
        className={cn(
          "flex flex-col gap-0.5",
          scrollable && "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1",
        )}
      >
        {data.map((row) => {
          const share = total > 0 ? (row.count / total) * 100 : 0;
          const focusShare =
            row.count > 0 ? (row.volvo_count / row.count) * 100 : 0;
          const isActive = active === row.key;

          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => toggle(row.key)}
                aria-pressed={isActive}
                className={cn(
                  "group w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  isActive &&
                    "bg-volvo-blue/[0.06] ring-1 ring-inset ring-volvo-blue/20",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 text-sm",
                      isActive
                        ? "font-semibold text-volvo-blue"
                        : "font-medium text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                        isActive
                          ? "bg-volvo-blue"
                          : "bg-border group-hover:bg-volvo-blue/40",
                      )}
                    />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">
                    {formatNumber(row.count)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {formatPercent(share)}&nbsp;%
                    </span>
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    {share > 0 ? (
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                          isActive
                            ? "bg-volvo-blue"
                            : "bg-volvo-blue/45 group-hover:bg-volvo-blue/70",
                        )}
                        style={{
                          width: `${share}%`,
                          // Synlig prikk for svært små andeler uten å overdrive 0 %.
                          minWidth: "3px",
                        }}
                      />
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs tabular-nums">
                    <span className="text-muted-foreground/70">
                      {brand.shortName}
                    </span>
                    <span className="font-semibold text-volvo-blue">
                      {formatPercent(focusShare, 0)}&nbsp;%
                    </span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="font-medium text-muted-foreground">Totalt</span>
        <span className="flex items-center gap-3 whitespace-nowrap tabular-nums">
          <span className="font-semibold text-foreground">
            {formatNumber(total)}
          </span>
          <span className="text-muted-foreground">
            {brand.shortName} {formatNumber(focusTotal)} ·{" "}
            <span className="font-semibold text-volvo-blue">
              {formatPercent(focusTotalShare, 0)}&nbsp;%
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
