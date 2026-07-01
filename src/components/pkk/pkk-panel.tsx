import { PkkFleetTable } from "@/components/pkk/pkk-fleet-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PopulationFilters } from "@/lib/population/filters";
import type { PkkPageData } from "@/lib/pkk/queries";

export function PkkPanel({
  data,
  filters,
  shortName,
}: {
  data: PkkPageData;
  filters: PopulationFilters;
  shortName: string;
}) {
  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente PKK-data: {data.error}
        </p>
      ) : null}

      {!data.hasPkkDates ? (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          PKK-datoer (siste kontroll og neste frist) er ikke synket ennå. Flåtelisten
          viser {shortName}-bestand per eier — PKK-kolonnene fylles når OFV-synken
          utvides med kontrolldata.
        </p>
      ) : null}

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Største {shortName}-flåter
            </CardTitle>
            <CardDescription>
              Topp 30 eiere rangert etter antall {shortName} i filtrert bestand.
              Klikk en eier for å se kjøretøy med PKK-status. Kolonnen «PKK ≤ 90 d.»
              teller {shortName}-kjøretøy med frist innen 90 dager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PkkFleetTable owners={data.fleetOwners} filters={filters} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
