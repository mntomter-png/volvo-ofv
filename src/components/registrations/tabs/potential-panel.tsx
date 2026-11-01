import { Download, Target, Gauge, UserX, RefreshCw } from "lucide-react";
import { KontoerFinanceFilter } from "@/components/registrations/kontoer-finance-filter";
import { PotentialProfileTable } from "@/components/registrations/potential-profile-table";
import { PotentialTable } from "@/components/registrations/potential-table";
import { MetricCards } from "@/components/kpi/metric-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { displayedHistoryStart } from "@/lib/ofv/customer-quality";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import {
  buildPotentialExportParams,
  getPotentialTabData,
} from "@/lib/registrations/potential-queries";

export async function PotentialPanel({
  filters,
  focusMake,
  excludeFinance = true,
  district = null,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
  excludeFinance?: boolean;
  district?: string | null;
}) {
  const data = await getPotentialTabData(
    filters,
    focusMake,
    excludeFinance,
    district,
  );
  const { profile, rows, totals, currentPeriod, lookbackStart, minFocusShare } =
    data;
  const historyStart = displayedHistoryStart(lookbackStart);

  const activeProfile =
    filters.bodywork != null
      ? profile.find((row) => row.bodyworkCode === filters.bodywork)
      : null;

  const exportParams = buildPotentialExportParams(filters, {
    excludeFinance,
    district,
  });

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente potensial: {data.error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Periode:</span>{" "}
        {formatDate(currentPeriod.from)}–{formatDate(currentPeriod.to)}.{" "}
        <span className="font-medium text-foreground">Kundebase:</span> fra{" "}
        {formatDate(historyStart)} (data fra 2020). Påbygg-tabellen viser hvor{" "}
        {focusMake} er sterk <span className="font-medium text-foreground">nasjonalt</span>{" "}
        (≥{formatPercent(minFocusShare * 100, 0)} % andel YTD). Handlingslisten
        er din call-liste over{" "}
        <span className="font-medium text-foreground">brukere</span>
        {district ? (
          <>
            {" "}
            i <span className="font-medium text-foreground">{district}</span>
          </>
        ) : filters.region != null ? (
          <> i valgt region</>
        ) : null}
        . Klikk et påbygg for å filtrere, eller et brukernavn for merke- og
        påbyggfordeling.
        {excludeFinance
          ? " Finans, leasing og merkeimportører er skjult."
          : " Finans, leasing og merkeimportører er inkludert."}
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <KontoerFinanceFilter />
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export/potential?${exportParams.toString()}`}>
            <Download />
            Excel
          </a>
        </Button>
      </div>

      <section className="mb-6">
        <MetricCards
          cards={[
            {
              key: "pipeline",
              title: "I pipeline",
              value: formatNumber(totals.accounts),
              description: activeProfile
                ? `Filtrert: ${activeProfile.bodyworkName}`
                : totals.accounts > rows.length
                  ? `Alle treff · listen viser topp ${formatNumber(rows.length)}`
                  : "Alle treff i utvalget",
              icon: Target,
            },
            {
              key: "avg-score",
              title: "Snitt score",
              value: formatNumber(totals.avgScore),
              description: "Fit + timing + størrelse",
              icon: Gauge,
            },
            {
              key: "untapped",
              title: "Aldri Volvo",
              value: formatNumber(totals.untapped),
              description: "Ingen tidligere Volvo-kjøp",
              icon: UserX,
            },
            {
              key: "reactivation",
              title: "Byttetid / konkurrent",
              value: formatNumber(totals.reactivation + totals.competitor),
              description: `${formatNumber(totals.reactivation)} byttetid · ${formatNumber(totals.competitor)} konkurrent`,
              icon: RefreshCw,
            },
          ]}
        />
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Volvo-sterke påbygg (nasjonalt)
          </CardTitle>
          <CardDescription>
            Markedsdefinisjon: påbygg der {focusMake} har ≥
            {formatPercent(minFocusShare * 100, 0)} % andel og minst{" "}
            {data.minVolume} enheter YTD i Norge. HK-fit er bøtten med høyest{" "}
            {focusMake}-andel. Klikk for å filtrere handlingslisten
            {district ? ` til ${district}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen påbygg når terskelen i dette filterutvalget.
            </p>
          ) : (
            <PotentialProfileTable profile={profile} focusMake={focusMake} />
          )}
        </CardContent>
      </Card>

      <Card id="handlingsliste">
        <CardHeader>
          <CardTitle className="text-base">
            Handlingsliste
            {activeProfile ? ` · ${activeProfile.bodyworkName}` : null}
          </CardTitle>
          <CardDescription>
            {activeProfile
              ? `Potensielle kunder med aktivitet i ${activeProfile.bodyworkName}. Klikk påbygg igjen for å vise alle. Klikk et brukernavn for flåte og segmentering.`
              : "Sortert etter score. Klikk et påbygg over for å filtrere, eller et brukernavn for å se merke-/påbyggfordeling. Hover score for detaljer."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PotentialTable rows={rows} focusMake={focusMake} />
        </CardContent>
      </Card>
    </>
  );
}
