import { Download, Target, Gauge, UserX, RefreshCw } from "lucide-react";
import { KontoerFinanceFilter } from "@/components/registrations/kontoer-finance-filter";
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
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getHpBucketLabel } from "@/lib/ofv/segmentation";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getPotentialTabData } from "@/lib/registrations/potential-queries";

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
  const { profile, rows, currentPeriod, lookbackStart, minFocusShare } = data;

  const untapped = rows.filter((row) => row.status === "untapped").length;
  const reactivation = rows.filter((row) =>
    row.status === "due" || row.status === "overdue",
  ).length;
  const competitor = rows.filter((row) =>
    row.status === "competitor" || row.status === "mixed",
  ).length;
  const avgScore =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + row.potentialScore, 0) / rows.length,
        )
      : 0;

  const exportParams = new URLSearchParams({
    year: String(filters.year),
    excludeFinance: excludeFinance ? "1" : "0",
  });
  if (filters.region != null) exportParams.set("region", String(filters.region));
  if (district) exportParams.set("district", district);
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  if (filters.pabygg) exportParams.set("pabygg", filters.pabygg);
  if (filters.bodywork != null) {
    exportParams.set("bodywork", String(filters.bodywork));
  }
  if (filters.hp != null) exportParams.set("hp", String(filters.hp));
  if (filters.fuel) exportParams.set("fuel", filters.fuel);
  if (filters.segment) exportParams.set("segment", filters.segment);

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
        {formatDate(lookbackStart)} (ca. 10 år). Listen rangerer{" "}
        <span className="font-medium text-foreground">brukere</span> i påbygg der{" "}
        {focusMake} har ≥{formatPercent(minFocusShare * 100, 0)} % markedsandel
        YTD, og som er ikke truffet, konkurrent eller forfalt.
        {excludeFinance
          ? " Finans, leasing og merkeimportører er skjult."
          : " Finans og leasing er inkludert."}
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
              value: formatNumber(rows.length),
              description: "Rangerte kontoer (maks 200)",
              icon: Target,
            },
            {
              key: "avg-score",
              title: "Snitt score",
              value: formatNumber(avgScore),
              description: "Fit + timing + størrelse",
              icon: Gauge,
            },
            {
              key: "untapped",
              title: "Ikke truffet",
              value: formatNumber(untapped),
              description: "Ingen tidligere fokusmerke",
              icon: UserX,
            },
            {
              key: "reactivation",
              title: "Reaktivering / konkurrent",
              value: formatNumber(reactivation + competitor),
              description: `${formatNumber(reactivation)} forfalt/forfaller · ${formatNumber(competitor)} konkurrent`,
              icon: RefreshCw,
            },
          ]}
        />
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Volvo-sterke AdditionalBodyworks
          </CardTitle>
          <CardDescription>
            Påbygg-koder med ≥{formatPercent(minFocusShare * 100, 0)} %{" "}
            {focusMake}-andel og minst {data.minVolume} enheter YTD. HK-fit er
            bøtten med høyest {focusMake}-andel i samme påbygg.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen påbygg når terskelen i dette filterutvalget.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Påbygg</th>
                    <th className="pb-2 pr-3 text-right font-medium">Volum</th>
                    <th className="pb-2 pr-3 text-right font-medium">
                      {focusMake} %
                    </th>
                    <th className="pb-2 pr-3 text-right font-medium">El %</th>
                    <th className="pb-2 font-medium">HK-fit</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.map((row) => (
                    <tr
                      key={row.bodyworkCode}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {row.bodyworkName}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(row.total)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatPercent(row.focusShare * 100, 0)} %
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatPercent(row.emobShare * 100, 0)} %
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {row.fitHpBucket != null
                          ? `${getHpBucketLabel(row.fitHpBucket)} (${formatPercent(row.fitHpFocusShare * 100, 0)} %)`
                          : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Handlingsliste</CardTitle>
          <CardDescription>
            Sortert etter potensialscore. Hover score for fit / timing /
            størrelse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PotentialTable rows={rows} focusMake={focusMake} />
        </CardContent>
      </Card>
    </>
  );
}
