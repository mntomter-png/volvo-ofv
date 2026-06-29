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

  const filterLabel = [
    filters.segment ?? "Alle segmenter",
    filters.make ?? "Alle merker",
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
        <PopulationFiltersBar segments={data.segments} makes={data.makes} />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="populasjon" views={savedViews} />
          <ExportCsvButton
            endpoint="/api/export/population"
            params={{
              segment: filters.segment,
              make: filters.make,
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
            <MakeShareChart data={data.byMake} highlightMake="Volvo" />
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
