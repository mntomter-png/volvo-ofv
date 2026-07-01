import { BuyerLoyaltyCards } from "@/components/registrations/buyer-loyalty-cards";
import { TopBuyersTable } from "@/components/registrations/top-buyers-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsPageData } from "@/lib/registrations/queries";

export function KjoperePanel({
  data,
  filters,
}: {
  data: RegistrationsPageData;
  filters: RegistrationsFilters;
}) {
  return (
    <>
      <section className="mb-6">
        <BuyerLoyaltyCards loyalty={data.buyerLoyalty} filters={filters} />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Største kjøpere i perioden</CardTitle>
            <CardDescription>
              Topp 15 eiere etter antall kjøp i filtrert periode. Dette er
              transaksjoner i utvalget — ikke total flåtestørrelse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopBuyersTable buyers={data.topBuyers} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
