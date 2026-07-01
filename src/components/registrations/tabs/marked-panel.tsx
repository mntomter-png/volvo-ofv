import { ElectricTrendChart } from "@/components/registrations/electric-trend-chart";
import { StackedMakeChart } from "@/components/registrations/stacked-make-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPabyggSegmentLabel } from "@/lib/ofv/segmentation";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getMarkedTabData } from "@/lib/registrations/queries";

export async function MarkedPanel({
  filters,
  focusMake,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
}) {
  const data = await getMarkedTabData(filters, focusMake);

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente markedsdata: {data.error}
        </p>
      ) : null}

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filters.pabygg
                ? "Merkekonkurranse over tid"
                : "Merkekonkurranse per påbygg"}
            </CardTitle>
            <CardDescription>
              {filters.pabygg
                ? `Toppmerker per måned i ${getPabyggSegmentLabel(filters.pabygg)}. Følger øvrige filtre.`
                : "Topp 5 merker (+ Andre) i hvert påbygg-segment. Følger øvrige filtre (utenom påbygg)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StackedMakeChart
              data={
                filters.pabygg
                  ? data.makeCompetitionByMonth
                  : data.makeCompetitionByPabygg
              }
              layout={filters.pabygg ? "horizontal" : "vertical"}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elektrifisering per segment</CardTitle>
            <CardDescription>
              Månedlig andel elektriske registreringer i de fem største
              OFV-segmentene. Følger øvrige filtre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ElectricTrendChart series={data.electricTrend} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
