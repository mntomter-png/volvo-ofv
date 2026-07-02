import { PkkDueVehiclesTable } from "@/components/pkk/pkk-due-vehicles-table";
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
          PKK-datoer er ikke tilgjengelig i bestand ennå. Flåtelisten viser{" "}
          {shortName}-kjøretøy per eier — kolonnene fylles når OFV-synken har
          kontrolldata for minst ett kjøretøy i utvalget.
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

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              PKK innen 6 måneder
            </CardTitle>
            <CardDescription>
              {shortName}-kjøretøy hos topp 30 kunder (samme rangering som
              flåtelisten) med PKK-frist innen de neste 6 månedene, inkludert
              forfalte. Sortert etter nærmeste frist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PkkDueVehiclesTable rows={data.dueVehicles} shortName={shortName} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
