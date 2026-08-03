/** Grupper kjøpere/storkunder på eier eller bruker (OFV primary_owner vs primary_user). */

export type CustomerParty = "owner" | "user";

export const CUSTOMER_PARTY_OPTIONS: {
  value: CustomerParty;
  label: string;
}[] = [
  { value: "owner", label: "Eier" },
  { value: "user", label: "Bruker" },
];

/** Default for Kjøpere: bruker (unngår finans-dominert eierliste). */
export function parseCustomerParty(
  raw: string | string[] | undefined,
  fallback: CustomerParty = "user",
): CustomerParty {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "owner" || value === "user") return value;
  return fallback;
}

export function customerPartyLabel(party: CustomerParty): string {
  return (
    CUSTOMER_PARTY_OPTIONS.find((opt) => opt.value === party)?.label ?? "Eier"
  );
}
