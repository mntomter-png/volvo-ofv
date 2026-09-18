/**
 * Fritekstsøk på eier/bruker i registrations og population.
 *
 * Navn matches som delstreng, org.nr. som prefiks. Søket treffer både
 * primary_owner_* og primary_user_*, slik at en selger finner kunden uansett
 * om den står som eier eller bruker (leasing gjør ofte finansselskapet til eier).
 *
 * Normaliseringen her må holdes identisk med predikatet i summary-RPC-ene
 * (se migrasjonen `owner_user_search_rpc`), ellers filtrerer kortene og
 * radtabellen ulikt på samme søk.
 */

/** Kortere søk gir for mange treff til å være nyttige. */
export const CUSTOMER_SEARCH_MIN_LENGTH = 2;
/** Org.nr.-prefiks under 3 siffer matcher nesten alt. */
const MIN_ORGNR_DIGITS = 3;
const MAX_SEARCH_LENGTH = 80;

const ORGNR_PATTERN = new RegExp(`^[0-9]{${MIN_ORGNR_DIGITS},}$`);

/** Normaliserer råverdien fra `?q=`. Returnerer null når søket er for kort. */
export function parseCustomerSearch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let trimmed = value
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  // «984 661 185» skal treffe org.nr. like godt som «984661185».
  if (/^[0-9 ]+$/.test(trimmed)) {
    trimmed = trimmed.replace(/ /g, "");
  }

  return trimmed.length >= CUSTOMER_SEARCH_MIN_LENGTH ? trimmed : null;
}

/** True når søket skal tolkes som et org.nr.-prefiks. */
export function isOrgnrSearch(search: string): boolean {
  return ORGNR_PATTERN.test(search);
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

  if (isOrgnrSearch(search)) {
    const orgnrPattern = quote(`${search}%`);
    clauses.push(`primary_owner_orgnr.like.${orgnrPattern}`);
    clauses.push(`primary_user_orgnr.like.${orgnrPattern}`);
  }

  return clauses.join(",");
}

/**
 * Legger `p_q` på RPC-argumenter. Bruk kun på funksjonene som faktisk har
 * parameteren (se migrasjonen `owner_user_search_rpc`) – PostgREST slår opp
 * funksjonen ut fra argumentnavnene og svarer 404 hvis `p_q` er ukjent.
 */
export function withCustomerSearch<T extends object>(
  args: T,
  search: string | null,
): T & { p_q: string | null } {
  return { ...args, p_q: search };
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
