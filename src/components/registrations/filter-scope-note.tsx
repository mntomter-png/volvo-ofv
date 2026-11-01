import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsTabId } from "@/lib/registrations/tabs";

/**
 * Filtre som bevisst ikke styrer fanen. Fleet-logikken på Region eies
 * av region-RPC-ene; her sier vi bare fra når valget ikke treffer.
 */
export function FilterScopeNote({
  filters,
  tab,
}: {
  filters: RegistrationsFilters;
  tab: RegistrationsTabId;
}) {
  const notes: string[] = [];

  if (filters.fleet !== "all" && tab !== "region" && tab !== "detaljer") {
    notes.push(
      "Fleet-filteret gjelder fanen Region & distrikt, tabellen under Detaljer og Excel-eksporten. Denne fanen viser tall uten fleet-avgrensning.",
    );
  }

  if (tab === "potensial" && (filters.make || filters.search)) {
    notes.push(
      "Merke og søk filtrerer kundelisten. Påbyggprofilen er nasjonal for perioden og følger ikke merke eller søk.",
    );
  }

  if (notes.length === 0) return null;

  return (
    <p className="mb-4 text-xs text-muted-foreground">{notes.join(" ")}</p>
  );
}
