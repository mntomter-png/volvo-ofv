export type PkkMinFleet = 3 | 5 | 10 | 20;

/** Grupper storkunder på eier eller bruker. */
export type PkkCustomerParty = "owner" | "user";

/** Hvilke PKK-frister som telles og vises. */
export type PkkHorizon = "actionable" | "upcoming" | "all";

export interface PkkFilters {
  region: number | null;
  minFleet: PkkMinFleet;
  onlyFollowUp: boolean;
  horizon: PkkHorizon;
  excludeFinance: boolean;
  customerParty: PkkCustomerParty;
  /** Søk i kundenavn, org.nr. og sted (eier/bruker avhengig av valgt part). */
  customerSearch: string | null;
}

export const PKK_MIN_FLEET_OPTIONS: { value: PkkMinFleet; label: string }[] = [
  { value: 3, label: "Min. 3 kjøretøy" },
  { value: 5, label: "Min. 5 kjøretøy" },
  { value: 10, label: "Min. 10 kjøretøy" },
  { value: 20, label: "Min. 20 kjøretøy" },
];

export const PKK_HORIZON_OPTIONS: { value: PkkHorizon; label: string }[] = [
  {
    value: "actionable",
    label: "Handlingsbar (forfalt ≤ 90 d. + 6 mnd)",
  },
  { value: "upcoming", label: "Kun kommende (6 mnd)" },
  { value: "all", label: "Alle frister (inkl. eldgamle)" },
];

export const PKK_CUSTOMER_PARTY_OPTIONS: {
  value: PkkCustomerParty;
  label: string;
}[] = [
  { value: "owner", label: "Eier" },
  { value: "user", label: "Bruker" },
];

function parseCustomerParty(raw: string | undefined): PkkCustomerParty {
  return raw === "user" ? "user" : "owner";
}

function parseHorizon(raw: string | undefined): PkkHorizon {
  if (raw === "upcoming" || raw === "all") return raw;
  return "actionable";
}

export function parsePkkSearchParams(
  params: Record<string, string | string[] | undefined>,
): PkkFilters {
  const regionRaw =
    typeof params.region === "string" ? Number.parseInt(params.region, 10) : NaN;
  const region =
    Number.isFinite(regionRaw) && regionRaw >= 1 && regionRaw <= 5
      ? regionRaw
      : null;

  const minFleetRaw =
    typeof params.minFleet === "string" ? Number.parseInt(params.minFleet, 10) : 5;
  const minFleet: PkkMinFleet =
    minFleetRaw === 3 || minFleetRaw === 10 || minFleetRaw === 20
      ? minFleetRaw
      : 5;

  const followUpRaw = params.followUp;
  const onlyFollowUp =
    followUpRaw !== "0" &&
    followUpRaw !== "false" &&
    (followUpRaw === undefined ||
      followUpRaw === "1" ||
      followUpRaw === "true" ||
      (Array.isArray(followUpRaw) &&
        !followUpRaw.includes("0") &&
        (followUpRaw.includes("1") || followUpRaw.includes("true"))));

  const horizonRaw =
    typeof params.horizon === "string" ? params.horizon : undefined;

  const financeRaw = params.excludeFinance;
  const excludeFinance =
    financeRaw !== "0" &&
    financeRaw !== "false" &&
    (financeRaw === undefined ||
      financeRaw === "1" ||
      financeRaw === "true" ||
      (Array.isArray(financeRaw) &&
        !financeRaw.includes("0") &&
        (financeRaw.includes("1") || financeRaw.includes("true"))));

  const partyRaw =
    typeof params.party === "string" ? params.party : undefined;

  const searchRaw = typeof params.q === "string" ? params.q.trim() : "";

  return {
    region,
    minFleet,
    onlyFollowUp,
    horizon: parseHorizon(horizonRaw),
    excludeFinance,
    customerParty: parseCustomerParty(partyRaw),
    customerSearch: searchRaw.length > 0 ? searchRaw : null,
  };
}

export function pkkFiltersToParams(filters: PkkFilters): Record<string, string> {
  const params: Record<string, string> = {
    minFleet: String(filters.minFleet),
    horizon: filters.horizon,
  };
  if (filters.region != null) params.region = String(filters.region);
  if (!filters.onlyFollowUp) params.followUp = "0";
  if (!filters.excludeFinance) params.excludeFinance = "0";
  if (filters.customerParty !== "owner") params.party = filters.customerParty;
  if (filters.customerSearch) params.q = filters.customerSearch;
  return params;
}

/** Filtrer storkunder på navn, org.nr. eller sted. */
export function filterPkkCustomers<T extends {
  owner_name: string;
  owner_orgnr: string | null;
  owner_location: string | null;
}>(customers: T[], search: string | null): T[] {
  const query = search?.trim().toLowerCase();
  if (!query) return customers;

  return customers.filter((customer) => {
    const haystack = [
      customer.owner_name,
      customer.owner_orgnr,
      customer.owner_location,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function pkkCustomerPartyLabel(party: PkkCustomerParty): string {
  return (
    PKK_CUSTOMER_PARTY_OPTIONS.find((opt) => opt.value === party)?.label ??
    "Eier"
  );
}

export function pkkHorizonDescription(horizon: PkkHorizon): string {
  switch (horizon) {
    case "upcoming":
      return "Kun fremtidige PKK-frister innen 6 måneder.";
    case "all":
      return "Inkluderer alle forfalte frister, også eldgamle.";
    default:
      return "Forfalt inntil 90 dager tilbake, pluss frister innen 6 måneder.";
  }
}
