export type PkkMinFleet = 3 | 5 | 10 | 20;

export interface PkkFilters {
  region: number | null;
  minFleet: PkkMinFleet;
  onlyFollowUp: boolean;
}

export const PKK_MIN_FLEET_OPTIONS: { value: PkkMinFleet; label: string }[] = [
  { value: 3, label: "Min. 3 kjøretøy" },
  { value: 5, label: "Min. 5 kjøretøy" },
  { value: 10, label: "Min. 10 kjøretøy" },
  { value: 20, label: "Min. 20 kjøretøy" },
];

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
    followUpRaw === "1" ||
    followUpRaw === "true" ||
    (Array.isArray(followUpRaw) &&
      (followUpRaw.includes("1") || followUpRaw.includes("true")));

  return { region, minFleet, onlyFollowUp };
}

export function pkkFiltersToParams(filters: PkkFilters): Record<string, string> {
  const params: Record<string, string> = {
    minFleet: String(filters.minFleet),
  };
  if (filters.region != null) params.region = String(filters.region);
  if (filters.onlyFollowUp) params.followUp = "1";
  return params;
}
