import { format } from "date-fns";
import { nb } from "date-fns/locale";
import Link from "next/link";
import type { Route } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type {
  TmfVersionModelParams,
  TmfVersionTrackingRow,
} from "@/lib/tmf/version-tracking";

interface TmfVersionTrackingPanelProps {
  rows: TmfVersionTrackingRow[];
  /** Modellparametrene som gjelder nå, for å vise hva som har flyttet seg. */
  currentModel: TmfVersionModelParams;
  /** Versjonen som er valgt for segmentdetaljer. */
  selectedId: string | null;
  /** Gjeldende søkeparametre, slik at lenkene ikke mister scenario og justeringer. */
  currentParams: string;
}

function changePct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

function DeltaValue({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tone =
    Math.abs(value) < 0.05
      ? "text-muted-foreground"
      : value < 0
        ? "text-amber-600"
        : "text-blue-600";

  return (
    <span className={`tabular-nums font-medium ${tone}`}>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {formatPercent(Math.abs(value), 1)} %
    </span>
  );
}

function dateLabel(iso: string): string {
  if (!iso) return "ukjent tidspunkt";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "ukjent tidspunkt";
  return format(parsed, "d. MMM yyyy", { locale: nb });
}

/** «Fryst» er bare riktig når tallene faktisk ble tatt vare på. */
function timestampLabel(row: TmfVersionTrackingRow): string {
  return row.snapshot
    ? `fryst ${dateLabel(row.snapshot.frozenAt || row.createdAt)}`
    : `lagret ${dateLabel(row.createdAt)}`;
}

/** Parametre som har flyttet seg siden versjonen ble fryst. */
function modelDrift(
  row: TmfVersionTrackingRow,
  currentModel: TmfVersionModelParams,
): string[] {
  if (!row.snapshot) return [];

  const comparisons: { label: string; then: number; now: number }[] = [
    { label: "Trendvekt", then: row.snapshot.model.trendWeight, now: currentModel.trendWeight },
    { label: "SSB-vekt", then: row.snapshot.model.signalWeight, now: currentModel.signalWeight },
    { label: "Makrovekt", then: row.snapshot.model.macroWeight, now: currentModel.macroWeight },
  ];

  return comparisons
    .filter((item) => Math.abs(item.then - item.now) > 0.001)
    .map(
      (item) =>
        `${item.label} ${item.then.toFixed(2).replace(".", ",")} → ${item.now
          .toFixed(2)
          .replace(".", ",")}`,
    );
}

export function TmfVersionTrackingPanel({
  rows,
  currentModel,
  selectedId,
  currentParams,
}: TmfVersionTrackingPanelProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-lg">Versjonssporing</h2>
          <p className="text-muted-foreground text-sm">
            Fryste prognoser målt mot dagens modell og faktiske registreringer.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Ingen lagrede versjoner ennå. Lagre en versjon for å fryse dagens tall —
            da kan de senere måles mot både en oppdatert modell og faktisk utfall.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Nyeste først, slik at sporingen leses som en tidslinje bakover.
  const ordered = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const explicit = selectedId ? ordered.find((row) => row.id === selectedId) : undefined;
  // Å vise en annen versjon enn den som ble klikket ville vært misvisende.
  const selectedLacksSnapshot = Boolean(explicit && !explicit.snapshot);
  const selected =
    explicit?.snapshot && explicit.live
      ? explicit
      : explicit
        ? null
        : (ordered.find((row) => row.snapshot && row.live) ?? null);

  function detailHref(id: string): Route {
    const params = new URLSearchParams(currentParams);
    params.set("version", id);
    return `/tmf?${params.toString()}` as Route;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Versjonssporing</h2>
        <p className="text-muted-foreground text-sm">
          Hver lagrede versjon beholder tallene slik de var da den ble lagret. Kolonnen
          «I dag» kjører de samme forutsetningene mot oppdatert OFV, SSB og kalibrering,
          så du ser hvor mye prognosen har flyttet seg — og til slutt om den traff.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fryst prognose vs. i dag vs. faktisk</CardTitle>
          <CardDescription>
            Endring er (i dag − fryst) / fryst. Avvik er (faktisk − fryst) / faktisk, med
            samme fortegn som backtesten: negativt betyr at prognosen var for høy.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Versjon</th>
                <th className="pb-3 pr-4 text-right font-medium">Målår</th>
                <th className="pb-3 pr-4 text-right font-medium">Fryst</th>
                <th className="pb-3 pr-4 text-right font-medium">I dag</th>
                <th className="pb-3 pr-4 text-right font-medium">Endring</th>
                <th className="pb-3 pr-4 text-right font-medium">Faktisk</th>
                <th className="pb-3 text-right font-medium">Avvik</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const frozen = row.snapshot?.total.market ?? null;
                const live = row.live?.market ?? null;
                const drift = modelDrift(row, currentModel);
                const isSelected = selected?.id === row.id;

                const actualError =
                  frozen != null && row.actual?.complete && row.actual.market > 0
                    ? ((row.actual.market - frozen) / row.actual.market) * 100
                    : null;

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border/50 ${
                      isSelected ? "bg-volvo-blue/5" : ""
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={detailHref(row.id)}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {row.configLabel} · {timestampLabel(row)}
                      </p>
                      {drift.length > 0 ? (
                        <p className="text-amber-600 text-xs">
                          Modell endret: {drift.join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.targetYear}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {frozen != null ? (
                        <>
                          {formatNumber(Math.round(frozen))}
                          <span className="block text-muted-foreground text-xs">
                            {formatNumber(Math.round(row.snapshot!.total.volvo))} Volvo
                          </span>
                        </>
                      ) : (
                        <span
                          className="text-muted-foreground"
                          title="Lagret før fryste tall ble innført"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {live != null ? (
                        <>
                          {formatNumber(Math.round(live))}
                          <span className="block text-muted-foreground text-xs">
                            {formatNumber(Math.round(row.live!.volvo))} Volvo
                          </span>
                        </>
                      ) : (
                        <span
                          className="text-muted-foreground"
                          title={row.liveUnavailableReason ?? undefined}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <DeltaValue
                        value={frozen != null && live != null ? changePct(frozen, live) : null}
                      />
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {row.actual ? (
                        <>
                          {formatNumber(row.actual.market)}
                          <span className="block text-muted-foreground text-xs">
                            {row.actual.complete
                              ? "hele året"
                              : `${row.actual.months} av 12 mnd`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {actualError != null ? (
                        <DeltaValue value={actualError} />
                      ) : (
                        <span
                          className="text-muted-foreground"
                          title={
                            row.actual
                              ? "Målåret er ikke ferdig ennå"
                              : "Målåret har ikke startet"
                          }
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedLacksSnapshot && explicit ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            «{explicit.name}» ble lagret før fryste tall ble innført, så det finnes ikke
            noe grunnlag å sammenligne segmentene mot. Nye versjoner får fryste tall
            automatisk.
          </CardContent>
        </Card>
      ) : null}

      {selected && selected.snapshot && selected.live ? (
        <Card>
          <CardHeader>
            <CardTitle>Segmentnivå – {selected.name}</CardTitle>
            <CardDescription>
              Hvor endringen siden{" "}
              {dateLabel(selected.snapshot.frozenAt || selected.createdAt)} kommer fra.
              Velg en annen versjon i tabellen over for å bytte.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Segment</th>
                  <th className="pb-3 pr-4 text-right font-medium">Fryst marked</th>
                  <th className="pb-3 pr-4 text-right font-medium">I dag</th>
                  <th className="pb-3 pr-4 text-right font-medium">Endring</th>
                  <th className="pb-3 text-right font-medium">Volvo fryst → i dag</th>
                </tr>
              </thead>
              <tbody>
                {selected.snapshot.segments.map((segment) => {
                  const liveSegment = selected.live!.segments.find(
                    (item) => item.pabygg === segment.pabygg,
                  );
                  return (
                    <tr key={segment.pabygg} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium">{segment.label}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(Math.round(segment.market))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {liveSegment ? (
                          formatNumber(Math.round(liveSegment.market))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <DeltaValue
                          value={
                            liveSegment ? changePct(segment.market, liveSegment.market) : null
                          }
                        />
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(Math.round(segment.volvo))}
                        {liveSegment
                          ? ` → ${formatNumber(Math.round(liveSegment.volvo))}`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
