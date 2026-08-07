"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  getHpBucketLabel,
  getPabyggSegmentLabel,
  getRegionLabel,
} from "@/lib/ofv/segmentation";
import {
  fetchPotentialPartyDetail,
  type PotentialPartyDetail,
} from "@/lib/registrations/potential-actions";
import type {
  PotentialAccountRow,
  PotentialStatus,
} from "@/lib/registrations/potential-queries";
import { cn } from "@/lib/utils";

/** Selgerspråk – unngå «forfalt» (høres ut som ubetalt faktura). */
const STATUS_LABEL: Record<PotentialStatus, string> = {
  untapped: "Aldri Volvo",
  competitor: "Kjøper konkurrent",
  mixed: "Volvo + konkurrent",
  due: "Byttetid 3–5 år",
  overdue: "Byttetid over 5 år",
};

const STATUS_HINT: Record<PotentialStatus, string> = {
  untapped: "Ingen tidligere Volvo-kjøp i kundebasen (ca. 10 år).",
  competitor: "Har kjøpt andre merker i perioden, ingen Volvo.",
  mixed: "Har både Volvo og andre merker i perioden.",
  due: "Siste Volvo-kjøp for 3–5 år siden – typisk byttesyklus.",
  overdue: "Siste Volvo-kjøp for mer enn 5 år siden.",
};

function drivelineLabel(value: string | null): string | null {
  if (value === "EMOB") return "El";
  if (value === "ICE") return "Diesel/ICE";
  return value;
}

function StatusBadge({ status }: { status: PotentialStatus }) {
  return (
    <span
      title={STATUS_HINT[status]}
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "untapped" &&
          "bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-200",
        status === "competitor" &&
          "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200",
        status === "mixed" &&
          "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200",
        status === "due" &&
          "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200",
        status === "overdue" &&
          "bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-200",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function scoreTitle(row: PotentialAccountRow): string {
  return [
    `Produktpassform ${row.fitScore}`,
    `Timing ${row.timingScore}`,
    `Størrelse ${row.sizeScore}`,
  ].join(" · ");
}

function BreakdownList({
  title,
  rows,
  focusMake,
  labelFor,
}: {
  title: string;
  rows: { name: string; count: number; focusCount: number }[];
  focusMake: string;
  labelFor?: (name: string) => string;
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {rows.slice(0, 8).map((row) => {
          const share = total > 0 ? (row.count / total) * 100 : 0;
          return (
            <li
              key={row.name}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {labelFor ? labelFor(row.name) : row.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatNumber(row.count)}
                {row.focusCount > 0 ? (
                  <>
                    {" "}
                    · {formatNumber(row.focusCount)} {focusMake}
                  </>
                ) : null}{" "}
                · {formatPercent(share, 0)} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PartyDetailPanel({
  detail,
  focusMake,
  error,
}: {
  detail: PotentialPartyDetail | null;
  focusMake: string;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!detail) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Ingen kjøpshistorikk funnet for denne brukeren.
      </p>
    );
  }

  if (detail.total === 0) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Ingen tunge nyregistreringer siste 10 år for denne brukeren.
      </p>
    );
  }

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3">
      <p className="mb-3 text-xs text-muted-foreground">
        Kjøpshistorikk siste 10 år · {formatNumber(detail.total)} enheter
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <BreakdownList
          title="Merke"
          rows={detail.makes}
          focusMake={focusMake}
        />
        <BreakdownList
          title="Påbygg-segment"
          rows={detail.pabygg}
          focusMake={focusMake}
          labelFor={getPabyggSegmentLabel}
        />
        <BreakdownList
          title="AdditionalBodyworks"
          rows={detail.bodyworks}
          focusMake={focusMake}
        />
      </div>
    </div>
  );
}

function PotentialRow({
  row,
  index,
  focusMake,
  expanded,
  onToggle,
}: {
  row: PotentialAccountRow;
  index: number;
  focusMake: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PotentialPartyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function handleToggle() {
    const willExpand = !expanded;
    onToggle();
    if (!willExpand || loaded) return;

    startTransition(async () => {
      const result = await fetchPotentialPartyDetail(row.partyKey);
      if (result.error) {
        setError(result.error);
        setDetail(null);
      } else {
        setError(null);
        setDetail(result.detail);
      }
      setLoaded(true);
    });
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/60 last:border-0",
          expanded && "bg-muted/30",
        )}
      >
        <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
          {index + 1}
        </td>
        <td className="py-2.5 pr-3">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            className={cn(
              "group flex max-w-full items-start gap-1.5 rounded-md text-left transition-colors",
              "hover:text-volvo-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          >
            <span className="mt-0.5 text-muted-foreground group-hover:text-volvo-blue">
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
            <span>
              <span className="font-medium underline-offset-2 group-hover:underline">
                {row.partyName}
              </span>
              {row.region != null || row.district ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[
                    row.region != null ? getRegionLabel(row.region) : null,
                    row.district,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
              {row.competitorUnits > 0 ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatNumber(row.competitorUnits)} konkurrent
                  {row.currentFocus > 0
                    ? ` · ${formatNumber(row.currentFocus)} ${focusMake}`
                    : null}
                </span>
              ) : null}
            </span>
          </button>
        </td>
        <td className="py-2.5 pr-3">
          <StatusBadge status={row.status} />
        </td>
        <td className="py-2.5 pr-3">
          <div className="font-medium">
            {row.recommendedBodyworkName ?? "–"}
          </div>
          <div className="text-xs text-muted-foreground">
            {[
              row.recommendedHpBucket != null
                ? getHpBucketLabel(row.recommendedHpBucket)
                : null,
              drivelineLabel(row.recommendedDriveline),
              row.bodyworkFocusShare > 0
                ? `${formatPercent(row.bodyworkFocusShare * 100, 0)} % ${focusMake}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums">
          {row.yearsSinceLast != null
            ? formatNumber(row.yearsSinceLast)
            : "–"}
          {row.lastFocusDate ? (
            <div className="text-xs text-muted-foreground">
              {formatDate(row.lastFocusDate)}
            </div>
          ) : null}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums">
          <span className="text-foreground">
            {formatNumber(row.fleetFocus)}
          </span>
          <span className="text-muted-foreground">
            {" "}
            / {formatNumber(row.fleetTotal)}
          </span>
        </td>
        <td
          className="py-2.5 text-right font-medium tabular-nums"
          title={scoreTitle(row)}
        >
          {formatNumber(row.potentialScore)}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border/60 last:border-0">
          <td colSpan={7} className="p-0">
            {isPending && !loaded ? (
              <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Henter flåte og segmentering…
              </p>
            ) : (
              <PartyDetailPanel
                detail={detail}
                focusMake={focusMake}
                error={error}
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function PotentialTable({
  rows,
  focusMake,
}: {
  rows: PotentialAccountRow[];
  focusMake: string;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen potensielle kontoer i Volvo-sterke påbygg (≥30 % andel) for
        utvalget.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Bruker</th>
            <th className="pb-2 pr-3 font-medium">Signal</th>
            <th className="pb-2 pr-3 font-medium">Foreslått tilbud</th>
            <th className="pb-2 pr-3 text-right font-medium">År siden Volvo</th>
            <th className="pb-2 pr-3 text-right font-medium">
              {focusMake} / flåte
            </th>
            <th className="pb-2 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <PotentialRow
              key={row.partyKey}
              row={row}
              index={index}
              focusMake={focusMake}
              expanded={expandedKey === row.partyKey}
              onToggle={() =>
                setExpandedKey((prev) =>
                  prev === row.partyKey ? null : row.partyKey,
                )
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
