import { ALL_PABYGG_SEGMENTS } from "@/lib/ofv/segmentation";
import { isTmfScenarioId, type TmfScenarioId } from "@/lib/tmf/scenarios";

/** Prosentjustering per påbygg-segment, f.eks. 5 = +5 %. */
export type TmfSegmentAdjustments = Partial<Record<string, number>>;

/** Overstyrt Volvo-markedsandel per segment (prosent). */
export type TmfVolvoShareOverrides = Partial<Record<string, number>>;

export interface TmfBudgetConfig {
  scenario: TmfScenarioId;
  segmentAdjustments: TmfSegmentAdjustments;
  volvoShareOverrides: TmfVolvoShareOverrides;
}

export interface TmfEstimateInput {
  scenarioId: TmfScenarioId;
  segmentAdjustments: TmfSegmentAdjustments;
  volvoShareOverrides: TmfVolvoShareOverrides;
}

const MAX_ADJUSTMENT_PCT = 50;
const MIN_ADJUSTMENT_PCT = -50;
const MIN_VOLVO_SHARE_PCT = 0;
const MAX_VOLVO_SHARE_PCT = 100;

function parseJsonRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseFloat(raw)
          : NaN;
    if (Number.isFinite(num)) result[key] = num;
  }
  return result;
}

function sanitizeAdjustments(input: Record<string, number>): TmfSegmentAdjustments {
  const result: TmfSegmentAdjustments = {};
  for (const segment of ALL_PABYGG_SEGMENTS) {
    const raw = input[segment];
    if (raw == null || !Number.isFinite(raw)) continue;
    result[segment] = Math.max(MIN_ADJUSTMENT_PCT, Math.min(MAX_ADJUSTMENT_PCT, raw));
  }
  return result;
}

function sanitizeVolvoOverrides(input: Record<string, number>): TmfVolvoShareOverrides {
  const result: TmfVolvoShareOverrides = {};
  for (const segment of ALL_PABYGG_SEGMENTS) {
    const raw = input[segment];
    if (raw == null || !Number.isFinite(raw)) continue;
    result[segment] = Math.max(MIN_VOLVO_SHARE_PCT, Math.min(MAX_VOLVO_SHARE_PCT, raw));
  }
  return result;
}

export function parseTmfJsonParam(
  value: string | string[] | undefined,
): Record<string, number> {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return {};
  try {
    return parseJsonRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function parseTmfEstimateInput(params: {
  scenario?: string | string[] | undefined;
  adj?: string | string[] | undefined;
  volvo?: string | string[] | undefined;
}): TmfEstimateInput {
  const scenarioRaw = typeof params.scenario === "string" ? params.scenario : "basis";
  return {
    scenarioId: isTmfScenarioId(scenarioRaw) ? scenarioRaw : "basis",
    segmentAdjustments: sanitizeAdjustments(parseTmfJsonParam(params.adj)),
    volvoShareOverrides: sanitizeVolvoOverrides(parseTmfJsonParam(params.volvo)),
  };
}

export function normalizeTmfBudgetConfig(config: unknown): TmfBudgetConfig {
  const raw = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const scenarioRaw = typeof raw.scenario === "string" ? raw.scenario : "basis";
  return {
    scenario: isTmfScenarioId(scenarioRaw) ? scenarioRaw : "basis",
    segmentAdjustments: sanitizeAdjustments(parseJsonRecord(raw.segmentAdjustments)),
    volvoShareOverrides: sanitizeVolvoOverrides(parseJsonRecord(raw.volvoShareOverrides)),
  };
}

export function analystMultiplier(adjustmentPct: number | undefined): number {
  const pct = adjustmentPct ?? 0;
  return 1 + pct / 100;
}

export function resolveVolvoSharePct(
  baselineSharePct: number,
  pabygg: string,
  overrides: TmfVolvoShareOverrides,
): number {
  const override = overrides[pabygg];
  return override != null ? override : baselineSharePct;
}

export function serializeTmfJsonParam(value: TmfSegmentAdjustments | TmfVolvoShareOverrides): string {
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      entry[1] != null && entry[1] !== 0 && Number.isFinite(entry[1]),
  );
  if (entries.length === 0) return "";
  return JSON.stringify(Object.fromEntries(entries));
}

export function describeTmfBudgetConfig(config: TmfBudgetConfig): string {
  const parts: string[] = [config.scenario];
  const adjCount = Object.keys(config.segmentAdjustments).length;
  const volvoCount = Object.keys(config.volvoShareOverrides).length;
  if (adjCount > 0) parts.push(`${adjCount} justering${adjCount === 1 ? "" : "er"}`);
  if (volvoCount > 0) parts.push(`${volvoCount} Volvo-overstyring${volvoCount === 1 ? "" : "er"}`);
  return parts.join(" · ");
}

export function buildTmfPageSearchParams(config: TmfBudgetConfig): URLSearchParams {
  const params = new URLSearchParams();
  params.set("scenario", config.scenario);
  const adj = serializeTmfJsonParam(config.segmentAdjustments);
  const volvo = serializeTmfJsonParam(config.volvoShareOverrides);
  if (adj) params.set("adj", adj);
  if (volvo) params.set("volvo", volvo);
  return params;
}
