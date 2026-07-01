import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PkkPanel } from "@/components/pkk/pkk-panel";
import { PopulationFiltersBar } from "@/components/population/population-filters";
import { formatDate } from "@/lib/dashboard/queries";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import { getPkkPageData } from "@/lib/pkk/queries";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { getPopulationFiltersContext } from "@/lib/population/queries";

export const metadata: Metadata = {
  title: "PKK-oppfølging",
};

export const dynamic = "force-dynamic";

export default async function PkkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("pkk");
  const brand = getUserBrand(user);

  const params = await searchParams;
  const filters = parsePopulationSearchParams(params);

  const [filterContext, pkkData] = await Promise.all([
    getPopulationFiltersContext(filters, brand.makeName),
    getPkkPageData(filters, brand.makeName),
  ]);

  const snapshotLabel = filterContext.snapshotDate
    ? formatDate(filterContext.snapshotDate)
    : "Venter på datasynk";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="PKK-oppfølging"
        description="Følg opp periodisk kjøretøykontroll for kunder med størst fokusmerke-flåte i bestand."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Bestand per {snapshotLabel}
      </p>

      <div className="mb-6">
        <PopulationFiltersBar
          segments={filterContext.segments}
          makes={filterContext.makes}
          regions={brand.showDealerRegions ? filterContext.regions : []}
          hpBuckets={filterContext.hpBuckets}
          fuels={filterContext.fuels}
          pabyggOptions={filterContext.pabyggOptions}
          dispOptions={filterContext.dispOptions}
          chassisOptions={filterContext.chassisOptions}
          ageOptions={filterContext.ageOptions}
        />
      </div>

      <PkkPanel
        data={pkkData}
        filters={filters}
        shortName={brand.shortName}
      />
    </div>
  );
}
