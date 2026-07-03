import type { TmfDriver } from "@/lib/ssb/types";

export const TMF_SCENARIOS = ["basis", "optimistic", "conservative"] as const;
export type TmfScenarioId = (typeof TMF_SCENARIOS)[number];

export interface TmfScenario {
  id: TmfScenarioId;
  label: string;
  description: string;
}

export const TMF_SCENARIO_OPTIONS: TmfScenario[] = [
  {
    id: "basis",
    label: "Basis",
    description: "SSB-drivere uten ekstra justering",
  },
  {
    id: "optimistic",
    label: "Optimistisk",
    description: "Sterkere bygg, distribusjon og langtransport",
  },
  {
    id: "conservative",
    label: "Konservativt",
    description: "Svakere makro og lavere transportvolum",
  },
];

/** Segment-spesifikke justeringer oppå SSB-driverindeks. */
const SCENARIO_DRIVER_ADJUSTMENTS: Record<
  TmfScenarioId,
  Partial<Record<TmfDriver, number>>
> = {
  basis: {},
  optimistic: {
    construction: 1.05,
    distribution: 1.05,
    long_haul: 1.03,
  },
  conservative: {
    construction: 0.95,
    distribution: 0.95,
    long_haul: 0.97,
  },
};

export function isTmfScenarioId(value: string): value is TmfScenarioId {
  return (TMF_SCENARIOS as readonly string[]).includes(value);
}

export function getTmfScenario(id: TmfScenarioId): TmfScenario {
  return TMF_SCENARIO_OPTIONS.find((scenario) => scenario.id === id) ?? TMF_SCENARIO_OPTIONS[0]!;
}

export function getScenarioDriverMultiplier(
  scenarioId: TmfScenarioId,
  driver: TmfDriver,
): number {
  return SCENARIO_DRIVER_ADJUSTMENTS[scenarioId][driver] ?? 1;
}

export function combinedDriverMultiplier(
  scenarioId: TmfScenarioId,
  driver: TmfDriver,
  ssbIndex: number,
): number {
  return ssbIndex * getScenarioDriverMultiplier(scenarioId, driver);
}
