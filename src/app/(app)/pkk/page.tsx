import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PkkFiltersBar } from "@/components/pkk/pkk-filters-bar";
import { PkkPanel } from "@/components/pkk/pkk-panel";
import { formatDate } from "@/lib/format";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import { parsePkkSearchParams } from "@/lib/pkk/filters";
import { getPkkCustomerNotes } from "@/lib/pkk/note-actions";
import { getPkkPageData } from "@/lib/pkk/queries";

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

  const [pkkData, notes] = await Promise.all([
    getPkkPageData(filters, brand.makeName),
    getPkkCustomerNotes(),
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
        <p className="text-sm text-muted-foreground">
          Bestand per {snapshotLabel}
        </p>
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
