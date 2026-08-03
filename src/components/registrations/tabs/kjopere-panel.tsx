import { BuyerLoyaltyCards } from "@/components/registrations/buyer-loyalty-cards";
import { BuyerPartyToggle } from "@/components/registrations/buyer-party-toggle";
import { TopBuyersTable } from "@/components/registrations/top-buyers-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  customerPartyLabel,
  type CustomerParty,
} from "@/lib/ofv/customer-party";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsPageData } from "@/lib/registrations/queries";

export function KjoperePanel({
  data,
  filters,
  customerParty,
}: {
  data: RegistrationsPageData;
  filters: RegistrationsFilters;
  customerParty: CustomerParty;
}) {
  const partyLabel = customerPartyLabel(customerParty).toLowerCase();

  return (
    <>
      <div className="mb-4">
        <BuyerPartyToggle />
      </div>

      <section className="mb-6">
        <BuyerLoyaltyCards
          loyalty={data.buyerLoyalty}
          filters={filters}
          customerParty={customerParty}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Største kjøpere i perioden
            </CardTitle>
            <CardDescription>
              Topp 15 {partyLabel}e etter antall kjøp i filtrert periode (samme
              filtre som over). Transaksjoner — ikke total flåtestørrelse. Bruk
              regionfilter for å snevre inn til ditt område.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopBuyersTable
              buyers={data.topBuyers}
              partyLabel={customerPartyLabel(customerParty)}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
