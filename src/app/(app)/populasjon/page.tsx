import type { Metadata } from "next";

import { MakeShareChart } from "@/components/dashboard/make-share-chart";
import { SegmentTable } from "@/components/dashboard/segment-table";
import { PageHeader } from "@/components/layout/page-header";
import { PopulationFiltersBar } from "@/components/population/population-filters";
import { PopulationSummaryCards } from "@/components/population/population-summary-cards";
import { PopulationTable } from "@/components/population/population-table";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { PopulasjonSaveReportViewButton } from "@/components/report-views/populasjon-report-view-toolbar";
import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { RegistrationsPagination } from "@/components/registrations/registrations-pagination";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/dashboard/queries";
import { getPabyggSegmentLabel, getRegionLabel } from "@/lib/ofv/segmentation";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { getPopulationPageData } from "@/lib/population/queries";
import { getReportViews } from "@/lib/report-views/queries";

export const metadata: Metadata = {
  title: "Populasjon / Bestand",
};

export default async function PopulasjonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parsePopulationSearchParams(params);

  const [data, savedViews] = await Promise.all([
    getPopulationPageData(filters),
    getReportViews("populasjon"),
  ]);

  const activeRegionLabel =
    filters.region != null ? getRegionLabel(filters.region) : null;
  const activeHpLabel =
    filters.hp != null
      ? (data.hpBuckets.find((option) => option.value === filters.hp)?.label ??
        `HK ${filters.hp}`)
      : null;
  const activePabyggLabel =
    filters.pabygg != null ? getPabyggSegmentLabel(filters.pabygg) : null;
  const activeDispLabel =
    filters.disp != null
      ? (data.dispOptions.find((option) => option.value === filters.disp)
          ?.label ?? `Slagvolum ${filters.disp}`)
      : null;
  const activeChassisLabel =
    filters.chassis != null
      ? (data.chassisOptions.find((option) => option.value === filters.chassis)
          ?.label ?? filters.chassis)
      : null;

  const filterLabel = [
    filters.segment ?? "Alle segmenter",
    filters.make ?? "Alle merker",
    activeRegionLabel ?? "Hele landet",
    activeHpLabel ?? "Alle HK",
    filters.fuel ?? "Alle drivstoff",
    activePabyggLabel ?? "Alle påbygg",
    activeDispLabel ?? "Alle slagvolum",
    activeChassisLabel ?? "Alle chassis",
  ].join(" · ");

  const snapshotLabel = data.snapshotDate
    ? formatDate(data.snapshotDate)
    : "Venter på datasynk";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Populasjon / Bestand"
        description="Oversikt over registrert bestand av tunge lastebiler (> 16t) i Norge, basert på OFVs siste populasjonssnapshot."
      >
        <Badge variant="accent">Tunge lastebiler &gt; 16t · {filterLabel}</Badge>
      </PageHeader>

      <p className="mb-6 text-sm text-muted-foreground">
        OFV-populasjon per {snapshotLabel}
      </p>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PopulationFiltersBar
          segments={data.segments}
          makes={data.makes}
          regions={data.regions}
          hpBuckets={data.hpBuckets}
          fuels={data.fuels}
          pabyggOptions={data.pabyggOptions}
          dispOptions={data.dispOptions}
          chassisOptions={data.chassisOptions}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="populasjon" views={savedViews} />
          <ExportCsvButton
            endpoint="/api/export/population"
            params={{
              segment: filters.segment,
              make: filters.make,
              region: filters.region,
              hp: filters.hp,
              fuel: filters.fuel,
              pabygg: filters.pabygg,
              disp: filters.disp,
              chassis: filters.chassis,
            }}
          />
          <PopulasjonSaveReportViewButton />
        </div>
      </div>

      <section className="mb-6">
        <PopulationSummaryCards
          summary={data.summary}
          snapshotDate={data.snapshotDate}
        />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkefordeling</CardTitle>
            <CardDescription>Topp 10 merker i filtrert bestand</CardDescription>
          </CardHeader>
          <CardContent>
            <MakeShareChart
              data={data.byMake}
              highlightMake="Volvo"
              total={data.summary.total}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmenter</CardTitle>
            <CardDescription>
              OFV-oppbygning (Usage) med Volvo-andel i bestand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentTable data={data.bySegment} />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regionfordeling</CardTitle>
            <CardDescription>
              Salgsregioner basert på brukerens postnummer. Klikk for å filtrere.
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
            <CardTitle className="text-base">Drivstoff-fordeling</CardTitle>
            <CardDescription>
              Drivlinje i bestand. Klikk for å filtrere.
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

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kjøretøy i bestand</CardTitle>
            <CardDescription>
              Enkeltkjøretøy med eier og bruker (poststed)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PopulationTable rows={data.rows} />
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
