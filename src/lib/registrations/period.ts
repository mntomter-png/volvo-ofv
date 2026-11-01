import {
  registrationQueryWindow,
  resolveRegistrationPeriod,
} from "@/lib/kpi/yoy";
import type { RegistrationsFilters } from "@/lib/registrations/filters";

/** Fra/til-datoer som sendes til RPC-ene. Måned og siste datadato er med. */
export function effectiveRegistrationDates(filters: RegistrationsFilters) {
  return registrationQueryWindow(filters);
}

/** Periode brukt i kjøper-KPI (samme vindu som SQL). */
export function resolveBuyerLoyaltyPeriod(filters: RegistrationsFilters): {
  from: string;
  to: string;
} {
  return resolveRegistrationPeriod(filters);
}
