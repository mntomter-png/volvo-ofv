import { KontoerFinanceFilter } from "@/components/registrations/kontoer-finance-filter";
import { KontoerKpiSection } from "@/components/registrations/kontoer-kpi-section";
import { displayedHistoryStart } from "@/lib/ofv/customer-quality";
import { formatDate } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getKontoerTabData } from "@/lib/registrations/kontoer-queries";

export async function KontoerPanel({
  filters,
  focusMake,
  excludeFinance = true,
  district = null,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
  excludeFinance?: boolean;
  district?: string | null;
}) {
  const data = await getKontoerTabData(
    filters,
    focusMake,
    excludeFinance,
    district,
  );
  const { summary, rows, currentPeriod, lookbackStart } = data;
  const historyStart = displayedHistoryStart(lookbackStart);

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente kundeutvikling: {data.error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Periode:</span>{" "}
        {formatDate(currentPeriod.from)}–{formatDate(currentPeriod.to)}{" "}
        (konkurrentkjøp).{" "}
        <span className="font-medium text-foreground">Kundebase:</span>{" "}
        {focusMake}-kjøp fra {formatDate(historyStart)} (data fra 2020), telt på
        brukeren som drifter bilen. Byttesyklus 3–5 år: forfaller (3–5), forfalt
        (5+). «Kun konkurrent» = 0 {focusMake} i perioden; «Også konkurrent» =
        både {focusMake} og andre. Klikk et KPI-kort for å se kundene.
        {excludeFinance
          ? " Finans, leasing og merkeimportører er skjult."
          : " Finans, leasing og merkeimportører er inkludert."}
      </p>

      <KontoerFinanceFilter />

      <KontoerKpiSection
        key={[
          filters.year,
          filters.region ?? "all",
          district ?? "all",
          filters.from ?? "",
          filters.to ?? "",
          excludeFinance ? "1" : "0",
        ].join("|")}
        summary={summary}
        initialRows={rows}
        filters={filters}
        focusMake={focusMake}
        excludeFinance={excludeFinance}
        district={district}
      />
    </>
  );
}
