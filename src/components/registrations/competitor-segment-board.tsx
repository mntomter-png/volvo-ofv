import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { SegmentDrillButton } from "@/components/registrations/segment-drill-button";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  focusPositionLabel,
  formatSharePoints,
  shareMove,
  type CompetitorSegment,
  type FocusShareHeadline,
  type ShareMove,
} from "@/lib/registrations/competitor-segments";
import { cn } from "@/lib/utils";

const MOVE_LABEL: Record<Exclude<ShareMove, "none">, string> = {
  gain: "Tar andel",
  loss: "Taper andel",
  flat: "Stabil",
};

export function CompetitorSegmentBoard({
  segments,
  focusName,
  headline,
}: {
  segments: CompetitorSegment[];
  focusName: string;
  headline: FocusShareHeadline | null;
}) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen registreringer i perioden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {headline ? <Headline headline={headline} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {segments.map((segment) => (
          <SegmentCard
            key={segment.pabygg}
            segment={segment}
            focusName={focusName}
          />
        ))}
      </div>
    </div>
  );
}

function Headline({ headline }: { headline: FocusShareHeadline }) {
  const Icon =
    headline.tone === "gain"
      ? TrendingUp
      : headline.tone === "loss"
        ? TrendingDown
        : Minus;

  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        headline.tone === "gain" &&
          "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        headline.tone === "loss" &&
          "border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-300",
        (headline.tone === "mixed" || headline.tone === "flat") &&
          "border-border bg-muted/40 text-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{headline.text}</span>
    </p>
  );
}

function SegmentCard({
  segment,
  focusName,
}: {
  segment: CompetitorSegment;
  focusName: string;
}) {
  const move = shareMove(segment.focusSharePointDelta);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-l-4 bg-background",
        move === "gain" && "border-l-emerald-600",
        move === "loss" && "border-l-red-600",
        (move === "flat" || move === "none") && "border-l-border",
      )}
    >
      <SegmentDrillButton
        segment={segment.pabygg}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {segment.label}
          </h3>
          {move === "none" ? null : <MoveBadge move={move} />}
        </div>
        <p className="text-sm">
          <span className="font-medium text-volvo-blue">{focusName}</span>
          <span className="text-muted-foreground">
            {" "}
            · {focusPositionLabel(segment.focusRank, segment.focusTied)}
          </span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tabular-nums">
          <span className="font-semibold text-foreground">
            {formatPercent(segment.focusSharePct, 1)} %
          </span>
          <ShareDelta delta={segment.focusSharePointDelta} />
          <span className="text-xs text-muted-foreground">
            {formatNumber(segment.focusCount)} av {formatNumber(segment.total)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">Se månedlig utvikling</p>
      </SegmentDrillButton>

      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[22rem] text-sm">
          <caption className="sr-only">
            Merkenes andel i {segment.label}
          </caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">
                Merke
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                Antall
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                Andel
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Endring
              </th>
            </tr>
          </thead>
          <tbody>
            {segment.makes.map((make) => (
              <tr
                key={make.make}
                className={cn(
                  "border-b border-border/60 last:border-b-0",
                  make.isFocus && "bg-volvo-blue/[0.06]",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "px-4 py-2 text-left font-normal",
                    make.isFocus && "font-semibold text-volvo-blue",
                  )}
                >
                  {make.make}
                </th>
                <td className="px-2 py-2 text-right tabular-nums">
                  <span className="font-medium">{formatNumber(make.count)}</span>
                  {make.previousSharePct != null ? (
                    <span className="block text-xs text-muted-foreground">
                      i fjor {formatNumber(make.previousCount)}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatPercent(make.sharePct, 1)} %
                </td>
                <td className="px-4 py-2 text-right">
                  <ShareDelta delta={make.sharePointDelta} />
                  {make.previousSharePct != null ? (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      fra {formatPercent(make.previousSharePct, 1)} %
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MoveBadge({ move }: { move: Exclude<ShareMove, "none"> }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        move === "gain" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        move === "loss" && "bg-red-500/10 text-red-600 dark:text-red-400",
        move === "flat" && "bg-muted text-muted-foreground",
      )}
    >
      {MOVE_LABEL[move]}
    </span>
  );
}

function ShareDelta({ delta }: { delta: number | null }) {
  const move = shareMove(delta);
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        move === "gain" && "text-emerald-700 dark:text-emerald-400",
        move === "loss" && "text-red-600 dark:text-red-400",
        (move === "flat" || move === "none") && "text-muted-foreground",
      )}
    >
      {formatSharePoints(delta)}
    </span>
  );
}
