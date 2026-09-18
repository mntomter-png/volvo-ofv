/**
 * Fritekstsøk på eier/bruker i registrations og population.
 *
 * Navn matches som delstreng, org.nr. som prefiks. Søket treffer både
 * primary_owner_* og primary_user_*, slik at en selger finner kunden uansett
 * om den står som eier eller bruker (leasing gjør ofte finansselskapet til eier).
 */

/** Kortere søk gir for mange treff til å være nyttige. */
export const CUSTOMER_SEARCH_MIN_LENGTH = 2;
/** Org.nr.-prefiks under 3 siffer matcher nesten alt. */
const MIN_ORGNR_DIGITS = 3;
const MAX_SEARCH_LENGTH = 80;

/** Normaliserer råverdien fra `?q=`. Returnerer null når søket er for kort. */
export function parseCustomerSearch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
  return trimmed.length >= CUSTOMER_SEARCH_MIN_LENGTH ? trimmed : null;
}

/**
 * Bygger PostgREST-uttrykket for `.or()`. Verdier pakkes i anførselstegn fordi
 * komma og parentes ellers tolkes som skilletegn i filtersyntaksen.
 */
export function customerSearchOrFilter(search: string): string {
  const pattern = quote(`%${search}%`);
  const clauses = [
    `primary_owner_name.ilike.${pattern}`,
    `primary_user_name.ilike.${pattern}`,
  ];

  const digits = search.replace(/\D/g, "");
  if (digits.length >= MIN_ORGNR_DIGITS) {
    const orgnrPattern = quote(`${digits}%`);
    clauses.push(`primary_owner_orgnr.like.${orgnrPattern}`);
    clauses.push(`primary_user_orgnr.like.${orgnrPattern}`);
  }

  return clauses.join(",");
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
