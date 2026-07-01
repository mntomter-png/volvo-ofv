import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type YoYMode = "percent" | "points";
export type YoYSentiment = "positive-growth" | "neutral";

export interface YoYIndicatorProps {
  current: number;
  previous: number;
  periodLabel: string;
  /** percent = relativ endring, points = prosentpoeng (for markedsandel). */
  mode?: YoYMode;
  /** For Volvo-tall er vekst positiv; for totalmarked kan vi bruke nøytral styling. */
  sentiment?: YoYSentiment;
  className?: string;
}

function formatDelta(value: number, mode: YoYMode): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (mode === "points") {
    return `${sign}${formatPercent(abs, 1)} pp`;
  }
  return `${sign}${formatPercent(abs, 1)} %`;
}

export function YoYIndicator({
  current,
  previous,
  periodLabel,
  mode = "percent",
  sentiment = "positive-growth",
  className,
}: YoYIndicatorProps) {
  const delta =
    mode === "points"
      ? current - previous
      : previous === 0
        ? current === 0
          ? 0
          : null
        : ((current - previous) / previous) * 100;

  const trend =
    delta === null ? "new" : delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const badgeClass =
    sentiment === "neutral"
      ? trend === "up"
        ? "bg-volvo-blue/8 text-volvo-blue"
        : "bg-muted text-muted-foreground"
      : trend === "up"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : trend === "down"
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-muted text-muted-foreground";

  const deltaLabel =
    trend === "new" ? "Ny" : delta !== null ? formatDelta(delta, mode) : null;

  return (
    <div className={cn("mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {deltaLabel !== null && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            badgeClass,
          )}
        >
          <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
          {deltaLabel}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        vs {periodLabel}
        <span className="mx-1 text-border">·</span>
        <span className="tabular-nums">{formatNumber(previous)}</span>
      </span>
    </div>
  );
}
