import type { Metadata } from "next";

import { ExportExcelButton } from "@/components/export/export-excel-button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { NyregistreringerSaveReportViewButton } from "@/components/report-views/nyregistreringer-report-view-toolbar";
import { RegistrationsFiltersBar } from "@/components/registrations/registrations-filters";
import { RegistrationsTabNav } from "@/components/registrations/registrations-tab-nav";
import { DetaljerPanel } from "@/components/registrations/tabs/detaljer-panel";
import { KjoperePanel } from "@/components/registrations/tabs/kjopere-panel";
import { MarkedPanel } from "@/components/registrations/tabs/marked-panel";
import { OversiktPanel } from "@/components/registrations/tabs/oversikt-panel";
import { RegionPanel } from "@/components/registrations/tabs/region-panel";
import { parseRegistrationsSearchParams } from "@/lib/registrations/filters";
import { getRegistrationsPageData } from "@/lib/registrations/queries";
import { parseRegistrationsTab } from "@/lib/registrations/tabs";
import { getReportViews } from "@/lib/report-views/queries";
import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess, canManageFleetVins } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Nyregistreringer",
};

export const dynamic = "force-dynamic";

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
] as const;

export default async function NyregistreringerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("nyregistreringer");
  const brand = getUserBrand(user);

  const params = await searchParams;
  const filters = parseRegistrationsSearchParams(params);
  const tab = parseRegistrationsTab(params.tab);

  const [data, savedViews] = await Promise.all([
    getRegistrationsPageData(filters, brand.makeName, tab),
    getReportViews("nyregistreringer"),
  ]);

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
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <RegistrationsFiltersBar
          segments={data.segments}
          makes={data.makes}
          regions={brand.showDealerRegions ? data.regions : []}
          hpBuckets={data.hpBuckets}
          fuels={data.fuels}
          pabyggOptions={data.pabyggOptions}
          dispOptions={data.dispOptions}
          chassisOptions={data.chassisOptions}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadReportViewSelect pageType="nyregistreringer" views={savedViews} />
          <ExportExcelButton
            endpoint="/api/export/registrations"
            params={{
              segment: filters.segment,
              make: filters.make,
              year: filters.year,
              region: filters.region,
              hp: filters.hp,
              fuel: filters.fuel,
              pabygg: filters.pabygg,
              disp: filters.disp,
              chassis: filters.chassis,
              from: filters.from,
              to: filters.to,
            }}
          />
          <NyregistreringerSaveReportViewButton />
        </div>
      </div>

      <RegistrationsTabNav activeTab={tab} />

      {tab === "oversikt" ? (
        <OversiktPanel
          data={data}
          filters={filters}
          year={filters.year}
          activeMonthLabel={activeMonthLabel}
          makeChartTotal={makeChartTotal}
          showDealerRegions={brand.showDealerRegions}
          shareLabel={brand.shareLabel}
        />
      ) : null}

      {tab === "region" ? (
        <RegionPanel
          filters={filters}
          focusMake={brand.makeName}
          showDealerRegions={brand.showDealerRegions}
          year={filters.year}
          canManageFleetVins={canManageFleetVins(user)}
        />
      ) : null}

      {tab === "marked" ? (
        <MarkedPanel filters={filters} focusMake={brand.makeName} />
      ) : null}

      {tab === "kjopere" ? (
        <KjoperePanel data={data} filters={filters} />
      ) : null}

      {tab === "detaljer" ? (
        <DetaljerPanel data={data} filters={filters} />
      ) : null}
    </div>
  );
}
