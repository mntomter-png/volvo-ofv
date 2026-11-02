export interface CentralFleetOrg {
  orgnr: string;
  name: string;
  note: string | null;
  active: boolean;
  updatedAt: string;
}

/** Norsk org.nr. med eller uten mellomrom. Tomt eller annet format gir null. */
export function normalizeOrgNr(value: string): string | null {
  const digits = value.replace(/\s+/g, "");
  return /^[0-9]{9}$/.test(digits) ? digits : null;
}

export function formatOrgNr(orgnr: string): string {
  const digits = normalizeOrgNr(orgnr);
  if (!digits) return orgnr;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
