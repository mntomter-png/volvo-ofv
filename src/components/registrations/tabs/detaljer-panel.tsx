import { RegistrationsPagination } from "@/components/registrations/registrations-pagination";
import { RegistrationsTable } from "@/components/registrations/registrations-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsPageData } from "@/lib/registrations/queries";

export function DetaljerPanel({
  data,
  filters,
}: {
  data: RegistrationsPageData;
  filters: RegistrationsFilters;
}) {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registreringer</CardTitle>
          <CardDescription>
            Enkeltregistreringer med eier og bruker, inkl. postnummer og poststed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RegistrationsTable rows={data.rows} />
          <RegistrationsPagination
            page={filters.page}
            totalPages={data.totalPages}
            totalRows={data.totalRows}
          />
        </CardContent>
      </Card>
    </section>
  );
}
