export type PkkMinFleet = 3 | 5 | 10 | 20;

/** Hvilke PKK-frister som telles og vises. */
export type PkkHorizon = "actionable" | "upcoming" | "all";

export interface PkkFilters {
  region: number | null;
  minFleet: PkkMinFleet;
  onlyFollowUp: boolean;
  horizon: PkkHorizon;
  excludeFinance: boolean;
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

  return {
    region,
    minFleet,
    onlyFollowUp,
    horizon: parseHorizon(horizonRaw),
    excludeFinance,
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
  return params;
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
