import type { Metadata } from "next";

import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { SegmentTable } from "@/components/dashboard/segment-table";
import { PageHeader } from "@/components/layout/page-header";
import { PopulationFiltersBar } from "@/components/population/population-filters";
import { PopulationSummaryCards } from "@/components/population/population-summary-cards";
import { PopulationTable } from "@/components/population/population-table";
import { ExportExcelButton } from "@/components/export/export-excel-button";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { PopulasjonSaveReportViewButton } from "@/components/report-views/populasjon-report-view-toolbar";
import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { RegistrationsPagination } from "@/components/registrations/registrations-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/dashboard/queries";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { getPopulationPageData } from "@/lib/population/queries";
import { getReportViews } from "@/lib/report-views/queries";
import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Populasjon / Bestand",
};

export default async function PopulasjonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("populasjon");
  const brand = getUserBrand(user);

  const params = await searchParams;
  const filters = parsePopulationSearchParams(params);

  const [data, savedViews] = await Promise.all([
    getPopulationPageData(filters, brand.makeName),
    getReportViews("populasjon"),
  ]);

  const snapshotLabel = data.snapshotDate
    ? formatDate(data.snapshotDate)
    : "Venter på datasynk";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Populasjon / Bestand"
        description="Oversikt over registrert bestand av tunge lastebiler (> 16t) i Norge, basert på OFVs siste populasjonssnapshot."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        OFV-populasjon per {snapshotLabel}
      </p>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PopulationFiltersBar
          segments={data.segments}
          makes={data.makes}
          regions={brand.showDealerRegions ? data.regions : []}
          hpBuckets={data.hpBuckets}
          fuels={data.fuels}
          pabyggOptions={data.pabyggOptions}
          dispOptions={data.dispOptions}
          chassisOptions={data.chassisOptions}
          ageOptions={data.ageOptions}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="populasjon" views={savedViews} />
          <ExportExcelButton
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
              age: filters.age,
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
            <BrandedMakeShareChart
              data={data.byMake}
              total={data.summary.total}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmenter</CardTitle>
            <CardDescription>
              OFV-oppbygning (Usage) med {brand.shareLabel.toLowerCase()} i bestand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentTable data={data.bySegment} />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        {brand.showDealerRegions ? (
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
        ) : null}

        <Card className={brand.showDealerRegions ? undefined : "lg:col-span-2"}>
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
