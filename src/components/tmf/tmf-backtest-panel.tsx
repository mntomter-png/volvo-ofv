import { formatNumber, formatPercent } from "@/lib/format";
import type { TmfBacktestResult } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfBacktestPanelProps {
  backtest: TmfBacktestResult;
}

function mapeColor(mape: number): string {
  if (mape <= 10) return "text-emerald-600";
  if (mape <= 20) return "text-amber-600";
  return "text-red-600";
}

const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

export function TmfBacktestPanel({ backtest }: TmfBacktestPanelProps) {
  const coreModel = backtest.models.find((model) => model.modelId === "core");
  const shippedModel = backtest.models.find(
    (model) => model.modelId === backtest.shippedModelId,
  );
  const tableModel = shippedModel ?? coreModel;
  const asOfLabel = MONTH_NAMES[backtest.asOfMonth - 1] ?? String(backtest.asOfMonth);

  if (!coreModel || coreModel.years.length === 0 || !tableModel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modellvalidering (backtest)</CardTitle>
          <CardDescription>
            Utilstrekkelig historikk for årlig backtest.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Modellvalidering</h2>
        <p className="text-muted-foreground text-sm">
          Årlig prognose vs. faktisk ({backtest.firstBacktestYear}–
          {backtest.lastBacktestYear}), simulert i {asOfLabel} året før målåret — samme
          tidspunkt som den levende prognosen lages.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {backtest.models.map((model) => {
          const isShipped = model.modelId === backtest.shippedModelId;
          return (
            <Card
              key={model.modelId}
              className={isShipped ? "border-volvo-blue/40 bg-volvo-blue/5" : undefined}
            >
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between gap-2">
                  <span>{model.modelLabel}</span>
                  {isShipped ? (
                    <span className="rounded bg-volvo-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-volvo-blue">
                      SETTER BÅNDET
                    </span>
                  ) : null}
                </CardDescription>
                <CardTitle className={`text-3xl tabular-nums ${mapeColor(model.mapeTotal)}`}>
                  MAPE {formatPercent(model.mapeTotal, 1)} %
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-muted-foreground text-xs">{model.description}</p>
                <p className="text-sm">
                  Volvo-MAPE:{" "}
                  <span className={`tabular-nums font-medium ${mapeColor(model.volvoMapeTotal)}`}>
                    {formatPercent(model.volvoMapeTotal, 1)} %
                  </span>
                </p>
                <p className="text-sm">
                  Bias:{" "}
                  <span className="tabular-nums font-medium">
                    {model.biasPct > 0 ? "+" : ""}
                    {formatPercent(model.biasPct, 1)} %
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    ({model.biasPct > 0
                      ? "underestimerer"
                      : model.biasPct < 0
                        ? "overestimerer"
                        : "nøytral"})
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Bånd: −{formatPercent(model.downsidePct, 1)} % / +
                  {formatPercent(model.upsidePct, 1)} %
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Årlig avvik – {tableModel.modelLabel}</CardTitle>
          <CardDescription>
            (Faktisk − prognose) / faktisk. Negativt = prognosen var for høy.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">År</th>
                <th className="pb-3 pr-4 text-right font-medium">Marked prognose</th>
                <th className="pb-3 pr-4 text-right font-medium">Faktisk</th>
                <th className="pb-3 pr-4 text-right font-medium">Avvik</th>
                <th className="pb-3 pr-4 text-right font-medium">Volvo prognose</th>
                <th className="pb-3 pr-4 text-right font-medium">Volvo faktisk</th>
                <th className="pb-3 text-right font-medium">Volvo avvik</th>
              </tr>
            </thead>
            <tbody>
              {tableModel.years.map((year) => (
                <tr key={year.year} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium tabular-nums">{year.year}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(year.forecastTotal))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(year.actualTotal))}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums ${
                      year.errorPct < 0
                        ? "text-amber-600"
                        : year.errorPct > 0
                          ? "text-blue-600"
                          : ""
                    }`}
                  >
                    {year.errorPct > 0 ? "+" : ""}
                    {formatPercent(year.errorPct, 1)} %
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(year.volvoForecastTotal))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(year.volvoActualTotal))}
                  </td>
                  <td
                    className={`py-3 text-right tabular-nums ${
                      year.volvoErrorPct < 0
                        ? "text-amber-600"
                        : year.volvoErrorPct > 0
                          ? "text-blue-600"
                          : ""
                    }`}
                  >
                    {year.volvoErrorPct > 0 ? "+" : ""}
                    {formatPercent(year.volvoErrorPct, 1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Treffsikkerhet per segment – {tableModel.modelLabel}</CardTitle>
          <CardDescription>
            MAPE er gjennomsnittlig absolutt avvik. Nedside og oppside er snittet av
            årene prognosen var for høy, respektive for lav, og setter segmentets
            P10/P90.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 text-right font-medium">MAPE</th>
                <th className="pb-3 pr-4 text-right font-medium">Nedside</th>
                <th className="pb-3 pr-4 text-right font-medium">Oppside</th>
                <th className="pb-3 text-right font-medium">Observasjoner</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(tableModel.mapeBySegment).map((segment) => (
                <tr key={segment.label} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{segment.label}</td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums font-medium ${mapeColor(segment.mape)}`}
                  >
                    {formatPercent(segment.mape, 1)} %
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-amber-600">
                    −{formatPercent(segment.downsidePct, 1)} %
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-blue-600">
                    +{formatPercent(segment.upsidePct, 1)} %
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">
                    {segment.observations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {backtest.driverCorrelations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SSB-driver korrelasjon</CardTitle>
            <CardDescription>
              Pearson-korrelasjon mellom årlig YoY i nyregistreringer og SSB-indikatorer
              per drivergruppe. Høy korrelasjon støtter bruk av driveren; lav korrelasjon
              tyder på svak prediktiv kraft.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Driver</th>
                  <th className="pb-3 pr-4 text-right font-medium">Korrelasjon</th>
                  <th className="pb-3 text-right font-medium">Observasjoner</th>
                </tr>
              </thead>
              <tbody>
                {backtest.driverCorrelations.map((driver) => (
                  <tr key={driver.driver} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{driver.label}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {driver.correlation == null
                        ? "–"
                        : driver.correlation.toFixed(2)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {driver.observations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Metodikknotater</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            {backtest.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
