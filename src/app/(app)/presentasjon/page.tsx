import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PresentationDeck } from "@/components/presentation/presentation-deck";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import { getPresentationDeckData } from "@/lib/presentation/queries";

export const metadata: Metadata = {
  title: "Presentasjon",
};

export const dynamic = "force-dynamic";

export default async function PresentasjonPage() {
  const user = await requirePageAccess("presentasjon");
  const brand = getUserBrand(user);
  const data = await getPresentationDeckData(brand.makeName);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Presentasjon"
        description="Markedsoversikt med live OFV-tall. Bruk piltaster, fullskjerm og eksporter til Excel eller PowerPoint."
      />
      <PresentationDeck data={data} />
    </div>
  );
}
