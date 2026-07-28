import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PopulationFiltersBar } from "@/components/population/population-filters";
import { OversiktPanel } from "@/components/population/tabs/oversikt-panel";
import { ExportExcelButton } from "@/components/export/export-excel-button";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { PopulasjonSaveReportViewButton } from "@/components/report-views/populasjon-report-view-toolbar";
import { formatDate } from "@/lib/dashboard/queries";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { getPopulationPageData } from "@/lib/population/queries";
import { getReportViews } from "@/lib/report-views/queries";
import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Populasjon / Bestand",
};

export const dynamic = "force-dynamic";

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

      <div className="mb-6 flex flex-col gap-3">
        <PopulationFiltersBar
          makes={data.makes}
          regions={brand.showDealerRegions ? data.regions : []}
          hpBuckets={data.hpBuckets}
          fuels={data.fuels}
          pabyggOptions={data.pabyggOptions}
          bodyworkOptions={data.bodyworkOptions}
          dispOptions={data.dispOptions}
          chassisOptions={data.chassisOptions}
          ageOptions={data.ageOptions}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="populasjon" views={savedViews} />
          <ExportExcelButton
            endpoint="/api/export/population"
            params={{
              make: filters.make,
              region: filters.region,
              district: filters.district,
              hp: filters.hp,
              fuel: filters.fuel,
              pabygg: filters.pabygg,
              bodywork: filters.bodywork,
              disp: filters.disp,
              chassis: filters.chassis,
              age: filters.age,
            }}
          />
          <PopulasjonSaveReportViewButton />
        </div>
      </div>

      <OversiktPanel
        data={data}
        filters={filters}
        showDealerRegions={brand.showDealerRegions}
        shareLabel={brand.shareLabel}
      />
    </div>
  );
}
