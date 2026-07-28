import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { BuyerLoyaltyCards } from "@/components/registrations/buyer-loyalty-cards";
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
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getRegionTabData } from "@/lib/registrations/queries";
import { getFleetVinRegistryInfo } from "@/lib/fleet/registry";
import { FLEET_FILTER_LABELS } from "@/lib/fleet";

export async function RegionPanel({
  filters,
  focusMake,
  showDealerRegions,
  year,
  canManageFleetVins,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
  showDealerRegions: boolean;
  year: number;
  canManageFleetVins: boolean;
}) {
  const [data, registry] = await Promise.all([
    getRegionTabData(filters, focusMake),
    showDealerRegions ? getFleetVinRegistryInfo() : Promise.resolve({
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
          Velg <strong>salgsregion</strong> i filterlinjen over for
          regionsspesifikke KPI-er og distriktsfordeling. Uten valgt region
          vises nasjonalt oversikt og sammenligning mellom regioner.
        </p>
      ) : null}

      {showDealerRegions ? (
        <section className="mb-6">
          <FleetRegionControls
            registry={registry}
            canUpload={canManageFleetVins}
          />
        </section>
      ) : null}

      <section className="mb-6">
        <RegionKpiCards data={data} filters={filters} />
      </section>

      {showDealerRegions ? (
        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">Regionsranking</CardTitle>
              <CardDescription>
                Alle salgsregioner sammenlignet. Andel av nasjonalt volum og
                markedsandel per region
                {filters.fleet !== "all"
                  ? ` (${FLEET_FILTER_LABELS[filters.fleet].toLowerCase()})`
                  : ""}
                . Klikk en region i filterlinjen for drill-down.
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
                {filters.fleet !== "all"
                  ? ` Fleet-filter: ${FLEET_FILTER_LABELS[filters.fleet].toLowerCase()}.`
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
              <DistrictBreakdownTable data={data.byDistrict} showRegionColumn={false} />
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
              . Følger øvrige filtre.
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
              Topp merker i valgt geografisk utvalg. Benchmark mot nasjonal
              andel: {data.nationalFocusShare.toFixed(1)} % {focusMake}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.byMake}
              total={data.scopedSummary.total}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <BuyerLoyaltyCards loyalty={data.buyerLoyalty} filters={filters} />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topp kjøpere i området</CardTitle>
            <CardDescription>
              Topp 10 eiere i filtrert region/distrikt. Transaksjoner i perioden
              — ikke total flåte.
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
