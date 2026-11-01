import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { BuyerLoyaltyCards } from "@/components/registrations/buyer-loyalty-cards";
import { BuyerPartyToggle } from "@/components/registrations/buyer-party-toggle";
import { DistrictBreakdownTable } from "@/components/registrations/district-breakdown-table";
import { FleetRegionControls } from "@/components/registrations/fleet-region-controls";
import { RegionBenchmarkTable } from "@/components/registrations/region-benchmark-table";
import { RegionKpiCards } from "@/components/registrations/region-kpi-cards";
import { RegistrationsMonthChart } from "@/components/registrations/registrations-month-chart";
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
import { getRegionTabData } from "@/lib/registrations/queries";
import { getFleetVinRegistryInfo } from "@/lib/fleet/registry";
import { FLEET_FILTER_LABELS } from "@/lib/fleet";
import {
  FLEET_BUYER_SHARE_NOTE,
  FLEET_DISTRICT_SHARE_NOTE,
  FLEET_MAKE_SHARE_NOTE,
  FLEET_MONTH_SHARE_NOTE,
  FLEET_RANKING_NOTE,
  FLEET_REGION_COMPETITOR_NOTE,
  REGION_NO_SELECTION_NOTE,
} from "@/lib/registrations/fleet-share";

export async function RegionPanel({
  filters,
  focusMake,
  showDealerRegions,
  year,
  canUseFleetFilter,
  canManageFleetVins,
  customerParty = "user",
}: {
  filters: RegistrationsFilters;
  focusMake: string;
  showDealerRegions: boolean;
  year: number;
  canUseFleetFilter: boolean;
  canManageFleetVins: boolean;
  customerParty?: CustomerParty;
}) {
  const fleetEnabled = showDealerRegions && canUseFleetFilter;
  const effectiveFilters = fleetEnabled
    ? filters
    : { ...filters, fleet: "all" as const };

  const [data, registry] = await Promise.all([
    getRegionTabData(effectiveFilters, focusMake, customerParty),
    fleetEnabled
      ? getFleetVinRegistryInfo()
      : Promise.resolve({
          vinCount: 0,
          lastUploadedAt: null,
          lastSourceLabel: null,
        }),
  ]);

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente regiondata: {data.error}
        </p>
      ) : null}

      {showDealerRegions && !data.selectedRegionLabel ? (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {REGION_NO_SELECTION_NOTE}
        </p>
      ) : null}

      {fleetEnabled ? (
        <section className="mb-6">
          <FleetRegionControls
            registry={registry}
            canUpload={canManageFleetVins}
          />
        </section>
      ) : null}

      <section className="mb-6">
        <RegionKpiCards data={data} filters={effectiveFilters} />
      </section>

      {showDealerRegions ? (
        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">Regionsranking</CardTitle>
              <CardDescription>
                Alle salgsregioner sammenlignet. Andel av nasjonalt volum og
                markedsandel per region
                {effectiveFilters.fleet !== "all"
                  ? ` (${FLEET_FILTER_LABELS[effectiveFilters.fleet].toLowerCase()})`
                  : ""}
                . Klikk en region i filterlinjen for drill-down.
                {effectiveFilters.fleet === "region"
                  ? ` ${FLEET_REGION_COMPETITOR_NOTE}`
                  : ""}
                {effectiveFilters.fleet === "fleet"
                  ? ` ${FLEET_RANKING_NOTE}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <RegionBenchmarkTable data={data.byRegion} />
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                {data.selectedRegionLabel
                  ? `Distrikter i ${data.selectedRegionLabel}`
                  : "Distriktsfordeling"}
              </CardTitle>
              <CardDescription>
                Basert på brukerens postnummer (Volvo-forhandlernett).
                {effectiveFilters.fleet !== "all"
                  ? ` Fleet-filter: ${FLEET_FILTER_LABELS[effectiveFilters.fleet].toLowerCase()}.`
                  : ""}
                {effectiveFilters.fleet === "fleet"
                  ? ` ${FLEET_DISTRICT_SHARE_NOTE}`
                  : ""}
                {data.selectedRegionLabel
                  ? " Kun distrikter i valgt region."
                  : " Alle distrikter i filtrert utvalg."}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <DistrictBreakdownTable
                data={data.byDistrict}
                showRegionColumn={!data.selectedRegionLabel}
                fleetFilter={effectiveFilters.fleet}
              />
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distriktsfordeling</CardTitle>
              <CardDescription>
                Geografisk fordeling basert på brukerens postnummer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistrictBreakdownTable
                data={data.byDistrict}
                showRegionColumn={false}
                fleetFilter={effectiveFilters.fleet}
              />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Månedlig trend</CardTitle>
            <CardDescription>
              Registreringer per måned i {year}
              {data.selectedRegionLabel
                ? ` · ${data.selectedRegionLabel}`
                : ""}
              . Følger øvrige filtre
              {effectiveFilters.fleet === "fleet"
                ? `. ${FLEET_MONTH_SHARE_NOTE}`
                : "."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsMonthChart data={data.byMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkekonkurranse</CardTitle>
            <CardDescription>
              Topp merker i valgt geografisk utvalg.{" "}
              {effectiveFilters.fleet === "fleet"
                ? `Fleet utgjør ${data.nationalFocusShare.toFixed(1)} % av det nasjonale markedet. ${FLEET_MAKE_SHARE_NOTE}`
                : effectiveFilters.fleet === "region"
                  ? `Benchmark mot nasjonal andel uten Volvo Fleet: ${data.nationalFocusShare.toFixed(1)} % ${focusMake}.`
                  : `Benchmark mot nasjonal andel: ${data.nationalFocusShare.toFixed(1)} % ${focusMake}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.byMake}
              total={data.makeChartTotal}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <div className="mb-4">
          <BuyerPartyToggle />
        </div>
        <BuyerLoyaltyCards
          loyalty={data.buyerLoyalty}
          filters={effectiveFilters}
          customerParty={customerParty}
          fleetFilter={effectiveFilters.fleet}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topp kjøpere i området</CardTitle>
            <CardDescription>
              Topp 10 {customerPartyLabel(customerParty).toLowerCase()}e i
              filtrert region/distrikt. Transaksjoner i perioden — ikke total
              flåte.
              {effectiveFilters.fleet === "fleet"
                ? ` ${FLEET_BUYER_SHARE_NOTE}`
                : ""}
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
