import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { SegmentTable } from "@/components/dashboard/segment-table";
import { PopulationSummaryCards } from "@/components/population/population-summary-cards";
import { PopulationTable } from "@/components/population/population-table";
import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { TopBuyersTable } from "@/components/registrations/top-buyers-table";
import { RegistrationsPagination } from "@/components/registrations/registrations-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PopulationFilters } from "@/lib/population/filters";
import type { PopulationPageData } from "@/lib/population/queries";

interface OversiktPanelProps {
  data: PopulationPageData;
  filters: PopulationFilters;
  showDealerRegions: boolean;
  shareLabel: string;
}

export function OversiktPanel({
  data,
  filters,
  showDealerRegions,
  shareLabel,
}: OversiktPanelProps) {
  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente populasjonsdata: {data.error}
        </p>
      ) : null}

      <section className="mb-6">
        <PopulationSummaryCards
          summary={data.summary}
          snapshotDate={data.snapshotDate}
        />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkefordeling</CardTitle>
            <CardDescription>Topp 10 merker i filtrert bestand</CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.byMake}
              total={data.summary.total}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmenter</CardTitle>
            <CardDescription>
              OFV-oppbygning (Usage) med {shareLabel.toLowerCase()} i bestand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentTable data={data.bySegment} />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        {showDealerRegions ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regionfordeling</CardTitle>
              <CardDescription>
                Salgsregioner basert på brukerens postnummer. Klikk for å filtrere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownTable
                queryKey="region"
                columnLabel="Region"
                hint="Klikk på en region for å filtrere siden."
                data={data.byRegion.map((row) => ({
                  key: String(row.region),
                  label: row.label,
                  count: row.count,
                  volvo_count: row.volvo_count,
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className={showDealerRegions ? undefined : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle className="text-base">Drivstoff-fordeling</CardTitle>
            <CardDescription>
              Drivlinje i bestand. Klikk for å filtrere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="fuel"
              columnLabel="Drivstoff"
              hint="Klikk på et drivstoff for å filtrere siden."
              data={data.byFuel.map((row) => ({
                key: row.fuel,
                label: row.fuel,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Største flåter i bestand</CardTitle>
            <CardDescription>
              Topp 15 eiere med minst 3 tunge lastebiler i filtrert bestand.
              Basert på OFV-populasjon — faktisk registrert flåte, ikke kjøp i
              periode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopBuyersTable buyers={data.fleetOwners} countLabel="Kjøretøy" />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kjøretøy i bestand</CardTitle>
            <CardDescription>
              Enkeltkjøretøy med eier og bruker (poststed)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PopulationTable rows={data.rows} />
            <RegistrationsPagination
              page={filters.page}
              totalPages={data.totalPages}
              totalRows={data.totalRows}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
