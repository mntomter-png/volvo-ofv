import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PkkFiltersBar } from "@/components/pkk/pkk-filters-bar";
import { PkkPanel } from "@/components/pkk/pkk-panel";
import { PkkReportViewToolbar } from "@/components/report-views/pkk-report-view-toolbar";
import { formatDate } from "@/lib/format";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import { parsePkkSearchParams } from "@/lib/pkk/filters";
import { getPkkCustomerNotes } from "@/lib/pkk/note-actions";
import { getPkkPageData } from "@/lib/pkk/queries";
import { getReportViews } from "@/lib/report-views/queries";

export const metadata: Metadata = {
  title: "PKK storkundeoppfølging",
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
  const filters = parsePkkSearchParams(params);

  const [pkkData, notes, savedViews] = await Promise.all([
    getPkkPageData(filters, brand.makeName),
    getPkkCustomerNotes(),
    getReportViews("pkk"),
  ]);

  const snapshotLabel = pkkData.snapshotDate
    ? formatDate(pkkData.snapshotDate)
    : "Venter på datasynk";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="PKK storkundeoppfølging"
        description="Prioriter oppfølging mot største kunder — forfalte og kommende PKK-frister på tunge lastebiler."
      />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Bestand per {snapshotLabel}
          </p>
          <PkkReportViewToolbar views={savedViews} />
        </div>
        <PkkFiltersBar showRegions={brand.showDealerRegions} />
      </div>

      <PkkPanel
        data={pkkData}
        filters={filters}
        notes={notes}
        shortName={brand.shortName}
      />
    </div>
  );
}
