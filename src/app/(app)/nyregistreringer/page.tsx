import type { Metadata } from "next";

import { MakeShareChart } from "@/components/dashboard/make-share-chart";
import { RegistrationsByMonthChart } from "@/components/dashboard/registrations-by-month-chart";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { NyregistreringerSaveReportViewButton } from "@/components/report-views/nyregistreringer-report-view-toolbar";
import { RegistrationsFiltersBar } from "@/components/registrations/registrations-filters";
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

  const filterLabel = [
    String(filters.year),
    filters.segment ?? "Alle segmenter",
    filters.make ?? "Alle merker",
  ].join(" · ");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Nyregistreringer"
        description="Detaljert registreringsstatistikk for tunge lastebiler (> 16t), med filtre, tabell og diagrammer."
      >
        <Badge variant="accent">Tunge lastebiler &gt; 16t · {filterLabel}</Badge>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <RegistrationsFiltersBar segments={data.segments} makes={data.makes} />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="nyregistreringer" views={savedViews} />
          <ExportCsvButton
            endpoint="/api/export/registrations"
            params={{
              segment: filters.segment,
              make: filters.make,
              year: filters.year,
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
              Førstegangsregistrerte tunge lastebiler i {filters.year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsByMonthChart data={data.byMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkefordeling</CardTitle>
            <CardDescription>Topp 10 merker i filtrert utvalg</CardDescription>
          </CardHeader>
          <CardContent>
            <MakeShareChart
              data={data.byMake}
              highlightMake="Volvo"
              total={data.summary.total}
            />
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
