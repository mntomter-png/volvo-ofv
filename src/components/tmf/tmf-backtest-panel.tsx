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

export function TmfBacktestPanel({ backtest }: TmfBacktestPanelProps) {
  const coreModel = backtest.models.find((model) => model.modelId === "core");
  const fullModel = backtest.models.find((model) => model.modelId === "full");

  if (!coreModel || coreModel.years.length === 0) {
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
          {backtest.lastBacktestYear}), simulert fra 1. januar hvert år.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[coreModel, fullModel].filter(Boolean).map((model) => (
          <Card key={model!.modelId}>
            <CardHeader className="pb-2">
              <CardDescription>{model!.modelLabel}</CardDescription>
              <CardTitle className={`text-3xl tabular-nums ${mapeColor(model!.mapeTotal)}`}>
                MAPE {formatPercent(model!.mapeTotal, 1)} %
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground text-xs">{model!.description}</p>
              <p className="text-sm">
                Bias:{" "}
                <span className="tabular-nums font-medium">
                  {model!.biasPct > 0 ? "+" : ""}
                  {formatPercent(model!.biasPct, 1)} %
                </span>
                <span className="text-muted-foreground text-xs">
                  {" "}
                  ({model!.biasPct > 0 ? "overestimerer" : model!.biasPct < 0 ? "underestimerer" : "nøytral"})
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Årlig avvik – OFV-kjerne</CardTitle>
          <CardDescription>
            Prognose vs. faktiske nyregistreringer (alle segmenter)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">År</th>
                <th className="pb-3 pr-4 text-right font-medium">Prognose</th>
                <th className="pb-3 pr-4 text-right font-medium">Faktisk</th>
                <th className="pb-3 pr-4 text-right font-medium">Avvik</th>
                <th className="pb-3 text-right font-medium">Abs. avvik</th>
              </tr>
            </thead>
            <tbody>
              {coreModel.years.map((year) => (
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
                      year.errorPct > 0 ? "text-amber-600" : year.errorPct < 0 ? "text-blue-600" : ""
                    }`}
                  >
                    {year.errorPct > 0 ? "+" : ""}
                    {formatPercent(year.errorPct, 1)} %
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatPercent(year.absErrorPct, 1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MAPE per segment – OFV-kjerne</CardTitle>
          <CardDescription>
            Gjennomsnittlig absolutt prosentavvik på tvers av backtest-år
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 text-right font-medium">MAPE</th>
                <th className="pb-3 text-right font-medium">Observasjoner</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(coreModel.mapeBySegment).map((segment) => (
                <tr key={segment.label} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{segment.label}</td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums font-medium ${mapeColor(segment.mape)}`}
                  >
                    {formatPercent(segment.mape, 1)} %
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
