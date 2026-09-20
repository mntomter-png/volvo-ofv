import { formatNumber, formatPercent } from "@/lib/format";
import {
  MAX_RENEWAL_EFFECT_PCT,
  RENEWAL_OVERDUE_WEIGHT,
  RENEWAL_PASS_THROUGH,
  type TmfRenewalSignal,
} from "@/lib/tmf/renewal";
import type { TmfRenewalSnapshotCoverage } from "@/lib/tmf/renewal-queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfRenewalPanelProps {
  signal: TmfRenewalSignal;
  focusMake?: string;
  snapshotCoverage?: TmfRenewalSnapshotCoverage;
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, 1)} %`;
}

/** Viser fornyelsespulje fra OFV-populasjon/PKK — beregnet, ikke manuelt felt. */
export function TmfRenewalPanel({
  signal,
  focusMake = "Volvo",
  snapshotCoverage,
}: TmfRenewalPanelProps) {
  const monthCount = snapshotCoverage?.monthCount ?? 0;
  const coverageLabel =
    monthCount === 0
      ? "Ingen månedlige snapshots ennå (lagres ved neste populasjonssynk)."
      : monthCount < 12
        ? `${monthCount} av 12 måneder lagret — kalibrering venter til vi har et års historikk.`
        : `${monthCount} måneder lagret — klart for kalibrering/backtest.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fornyelsespulje (alder og PKK)</CardTitle>
        <CardDescription>
          Kjøretøy ≥{signal.oldYears} år i siste OFV-populasjon, pluss forfalt
          PKK (vekt {Math.round(RENEWAL_OVERDUE_WEIGHT * 100)} %). PKK innen 12
          måneder er nesten hele bestanden og brukes ikke. Trykket er relativ
          dekning (pulje / trailing 12 mnd) mot markedssnittet
          {signal.marketCoverYears > 0
            ? ` (${formatPercent(signal.marketCoverYears, 1)} år)`
            : ""}
          , dempet til {Math.round(RENEWAL_PASS_THROUGH * 100)} % gjennomslag
          (maks ±{MAX_RENEWAL_EFFECT_PCT} %). Uten historiske snapshots
          omfordeler signalet mellom segmentene — det hever ikke totalmarkedet
          blindt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">{coverageLabel}</p>
        {signal.segments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ingen fornyelsesdata ennå. Kjør migrasjonen for{" "}
            <span className="font-mono text-xs">tmf_renewal_pool</span>, eller
            synk populasjon med registreringsdatoer.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Segment</th>
                    <th className="pb-3 pr-3 font-medium text-right">Bestand</th>
                    <th className="pb-3 pr-3 font-medium text-right">
                      ≥{signal.oldYears} år
                    </th>
                    <th className="pb-3 pr-3 font-medium text-right">
                      Forfalt PKK
                    </th>
                    <th className="pb-3 pr-3 font-medium text-right">
                      PKK ≤90 d
                    </th>
                    <th className="pb-3 pr-3 font-medium text-right">
                      {focusMake} ≥{signal.oldYears} år
                    </th>
                    <th className="pb-3 pr-3 font-medium text-right">
                      Trailing 12 mnd
                    </th>
                    <th className="pb-3 font-medium text-right">Effekt</th>
                  </tr>
                </thead>
                <tbody>
                  {signal.segments.map((segment) => (
                    <tr key={segment.pabygg} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{segment.label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(segment.stockCount)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(segment.oldCount)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(segment.overdueCount)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(segment.due90Count)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(segment.focusOldCount)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(Math.round(segment.trailing12Count))}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {signedPct(segment.effectPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {Math.abs(signal.effectPct) < 0.05 ? (
                <p className="text-muted-foreground">
                  Totalmarkedet er nesten uendret ({signedPct(signal.effectPct)}
                  ) — signalet omfordeler mellom segmentene etter relativ alder.
                </p>
              ) : (
                <p>
                  Effekt på totalmarkedet:{" "}
                  <span className="font-medium tabular-nums">
                    {signedPct(signal.effectPct)}
                  </span>
                  {signal.clamped
                    ? ` (begrenset til ±${MAX_RENEWAL_EFFECT_PCT} %)`
                    : null}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
