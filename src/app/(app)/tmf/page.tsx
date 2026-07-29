import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Suspense } from "react";

import { SsbDriverPanel } from "@/components/tmf/ssb-driver-panel";
import { TmfAdjustmentsPanel } from "@/components/tmf/tmf-adjustments-panel";
import { TmfBacktestPanel } from "@/components/tmf/tmf-backtest-panel";
import { TmfBudgetToolbar } from "@/components/tmf/tmf-budget-toolbar";
import { TmfForecastChart } from "@/components/tmf/tmf-forecast-chart";
import { TmfForecastSummary } from "@/components/tmf/tmf-forecast-summary";
import { TmfMethodologyPanel } from "@/components/tmf/tmf-methodology-panel";
import { TmfNextYearPanel } from "@/components/tmf/tmf-next-year-panel";
import { TmfScenarioSelector } from "@/components/tmf/tmf-scenario-selector";
import { TmfSegmentTable } from "@/components/tmf/tmf-segment-table";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePageAccess } from "@/lib/auth/roles";
import { getSsbSyncStatus } from "@/lib/ssb/queries";
import { getTmfBudgetVersions } from "@/lib/tmf/budget-queries";
import { getTmfPageData, parseTmfPageInput } from "@/lib/tmf/queries";

export const dynamic = "force-dynamic";

export default async function TmfPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("tmf");

  const params = await searchParams;
  const input = parseTmfPageInput(params);

  const [tmfData, syncStatus, budgets] = await Promise.all([
    getTmfPageData(input),
    getSsbSyncStatus(),
    getTmfBudgetVersions(),
  ]);

  const { estimate, backtest, driverGroups: groups } = tmfData;

  const { currentYear, nextYear } = estimate;

  const lastSyncLabel = syncStatus.lastSyncAt
    ? format(new Date(syncStatus.lastSyncAt), "d. MMM yyyy HH:mm", { locale: nb })
    : "Aldri";

  return (
    <div className="space-y-6">
      <PageHeader
        title="TMF – Total Market Forecast"
        description="Markedspotensial i OFV-nyregistreringer (N3 ≥16t). Leveranse kommer senere."
      />

      <Suspense fallback={null}>
        <TmfBudgetToolbar budgets={budgets} nextYear={nextYear.year} />
      </Suspense>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Scenario</h2>
        <Suspense fallback={null}>
          <TmfScenarioSelector />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <TmfAdjustmentsPanel />
      </Suspense>

      <TmfNextYearPanel estimate={estimate} />

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Inneværende år ({currentYear.year})</h2>
        <TmfForecastSummary forecast={currentYear} />
      </div>

      <TmfForecastChart year={currentYear.year} monthly={currentYear.total.monthly} />

      <TmfSegmentTable year={currentYear.year} segments={currentYear.segments} />

      <TmfBacktestPanel backtest={backtest} />

      <TmfMethodologyPanel />

      <Card>
        <CardHeader>
          <CardTitle>Datagrunnlag</CardTitle>
          <CardDescription>
            OFV nyregistreringer (N3 ≥16t) og SSB-indikatorer synket automatisk.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Siste SSB-synk
            </p>
            <p className="font-medium text-sm">{lastSyncLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              SSB-datapunkter
            </p>
            <p className="font-medium text-sm tabular-nums">
              {syncStatus.indicatorCount.toLocaleString("nb-NO")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Sesongkalibrering
            </p>
            <p className="font-medium text-sm">
              {currentYear.seasonalityYears[0]}–{currentYear.seasonalityYears.at(-1)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Neste år
            </p>
            <p className="font-medium text-sm tabular-nums">
              {formatNumberRounded(nextYear.total.annualVolvo)} Volvo /{" "}
              {formatNumberRounded(nextYear.total.annualMarket)} marked
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-lg">SSB-drivere</h2>
          <p className="text-muted-foreground text-sm">
            Ledende indikatorer fra Statistisk sentralbyrå, gruppert etter TMF-segment.
          </p>
        </div>
        <SsbDriverPanel groups={groups} />
      </div>
    </div>
  );
}

function formatNumberRounded(value: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}
