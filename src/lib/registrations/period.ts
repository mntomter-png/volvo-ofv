import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { resolveRegistrationPeriod } from "@/lib/kpi/yoy";

/** Fra/til-datoer som brukes når år er valgt uten eksplisitt datointervall. */
export function effectiveRegistrationDates(filters: RegistrationsFilters) {
  if (filters.from || filters.to) {
    return { from: filters.from, to: filters.to };
  }
  const period = resolveRegistrationPeriod(filters);
  return { from: period.from, to: period.to };
}

/** Periode brukt i kjøper-KPI (matcher SQL når månedfilter er satt). */
export function resolveBuyerLoyaltyPeriod(filters: RegistrationsFilters): {
  from: string;
  to: string;
} {
  const fallback = resolveRegistrationPeriod(filters);
  const base = effectiveRegistrationDates(filters);
  let from = base.from ?? fallback.from;
  let to = base.to ?? fallback.to;

  if (filters.month != null) {
    const monthStart = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    const nextMonthDate = new Date(`${monthStart}T12:00:00`);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    nextMonthDate.setDate(0);
    const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-${String(nextMonthDate.getDate()).padStart(2, "0")}`;
    if (from < monthStart) from = monthStart;
    if (to > monthEnd) to = monthEnd;
  }

  return { from, to };
}
