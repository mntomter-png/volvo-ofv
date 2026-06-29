import type { Metadata } from "next";

import { MakeShareChart } from "@/components/dashboard/make-share-chart";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { NyregistreringerSaveReportViewButton } from "@/components/report-views/nyregistreringer-report-view-toolbar";
import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { FleetTables } from "@/components/registrations/fleet-tables";
import { MakeMonthIndicator } from "@/components/registrations/make-month-indicator";
import { RegistrationsFiltersBar } from "@/components/registrations/registrations-filters";
import { RegistrationsMonthChart } from "@/components/registrations/registrations-month-chart";
import { RegistrationsPagination } from "@/components/registrations/registrations-pagination";
import { RegistrationsSummaryCards } from "@/components/registrations/registrations-summary-cards";
import { RegistrationsTable } from "@/components/registrations/registrations-table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseRegistrationsSearchParams } from "@/lib/registrations/filters";
import { getRegistrationsPageData } from "@/lib/registrations/queries";
import { getReportViews } from "@/lib/report-views/queries";

export const metadata: Metadata = {
  title: "Nyregistreringer",
};

export default async function NyregistreringerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseRegistrationsSearchParams(params);

  const [data, savedViews] = await Promise.all([
    getRegistrationsPageData(filters),
    getReportViews("nyregistreringer"),
  ]);

  const activeRegionLabel =
    filters.region != null
      ? (data.regions.find((option) => option.value === filters.region)?.label ??
        `Region ${filters.region}`)
      : null;

  const activeHpLabel =
    filters.hp != null
      ? (data.hpBuckets.find((option) => option.value === filters.hp)?.label ??
        `HK-bøtte ${filters.hp}`)
      : null;

  const filterLabel = [
    String(filters.year),
    filters.segment ?? "Alle segmenter",
    filters.make ?? "Alle merker",
    activeRegionLabel ?? "Hele landet",
    activeHpLabel ?? "Alle HK",
    filters.fuel ?? "Alle drivstoff",
  ].join(" · ");

  const MONTH_NAMES = [
    "Januar",
    "Februar",
    "Mars",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const activeMonthLabel =
    filters.month != null
      ? `${MONTH_NAMES[filters.month - 1]} ${filters.year}`
      : null;

  const makeChartTotal =
    filters.month != null
      ? (data.byMonth.find(
          (row) => Number.parseInt(row.month.slice(5, 7), 10) === filters.month,
        )?.count ?? 0)
      : data.summary.total;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Nyregistreringer"
        description="Detaljert registreringsstatistikk for tunge lastebiler (> 16t), med filtre, tabell og diagrammer."
      >
        <Badge variant="accent">Tunge lastebiler &gt; 16t · {filterLabel}</Badge>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <RegistrationsFiltersBar
          segments={data.segments}
          makes={data.makes}
          regions={data.regions}
          hpBuckets={data.hpBuckets}
          fuels={data.fuels}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="nyregistreringer" views={savedViews} />
          <ExportCsvButton
            endpoint="/api/export/registrations"
            params={{
              segment: filters.segment,
              make: filters.make,
              year: filters.year,
              region: filters.region,
              hp: filters.hp,
              fuel: filters.fuel,
            }}
          />
          <NyregistreringerSaveReportViewButton />
        </div>
      </div>

      <section className="mb-6">
        <RegistrationsSummaryCards summary={data.summary} year={filters.year} />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per måned</CardTitle>
            <CardDescription>
              Førstegangsregistrerte tunge lastebiler i {filters.year}. Klikk på
              en måned for å filtrere merkefordelingen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsMonthChart data={data.byMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Merkefordeling</CardTitle>
              {activeMonthLabel ? (
                <MakeMonthIndicator monthLabel={activeMonthLabel} />
              ) : null}
            </div>
            <CardDescription>
              {activeMonthLabel
                ? `Topp 10 merker i ${activeMonthLabel}`
                : "Topp 10 merker i filtrert utvalg"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MakeShareChart
              data={data.byMake}
              highlightMake="Volvo"
              total={makeChartTotal}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regionfordeling</CardTitle>
            <CardDescription>
              Salgsregioner (Volvo-forhandlernett) basert på brukerens postnummer.
              Klikk på en region for å filtrere hele siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="region"
              columnLabel="Region"
              hint="Klikk på en region for å filtrere siden."
              data={data.byRegion.map((row) => ({
                key: String(row.region),
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">HK-fordeling</CardTitle>
            <CardDescription>
              Effekt (HK) per bøtte. Elektriske/ukjente er utelatt. Klikk på en
              bøtte for å filtrere hele siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="hp"
              columnLabel="HK"
              hint="Klikk på en HK-bøtte for å filtrere siden."
              data={data.byHp.map((row) => ({
                key: String(row.bucket),
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drivstoff-fordeling</CardTitle>
            <CardDescription>
              Drivlinje (diesel, elektrisk, gass). Klikk på et drivstoff for å
              filtrere hele siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="fuel"
              columnLabel="Drivstoff"
              hint="Klikk på et drivstoff for å filtrere siden."
              data={data.byFuel.map((row) => ({
                key: row.fuel,
                label: row.fuel,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flåter</CardTitle>
            <CardDescription>
              Kjøp per eier i perioden. Finans, leasing og importører er utelatt
              for å vise reelle flåter. Følger aktive filtre (utenom merke).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FleetTables fleet={data.fleet} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registreringer</CardTitle>
            <CardDescription>
              Enkeltregistreringer med eier og bruker (poststed)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RegistrationsTable rows={data.rows} />
            <RegistrationsPagination
              page={filters.page}
              totalPages={data.totalPages}
              totalRows={data.totalRows}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
