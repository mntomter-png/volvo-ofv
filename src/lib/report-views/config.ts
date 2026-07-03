import type { Route } from "next";

import type { PkkFilters, PkkHorizon, PkkMinFleet, PkkCustomerParty } from "@/lib/pkk/filters";
import { pkkCustomerPartyLabel, PKK_HORIZON_OPTIONS, PKK_MIN_FLEET_OPTIONS } from "@/lib/pkk/filters";
import type { PageType, ReportViewConfig } from "@/lib/supabase/types";

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  dashboard: "Oversikt",
  nyregistreringer: "Nyregistreringer",
  populasjon: "Populasjon / Bestand",
  pkk: "PKK storkundeoppfølging",
};

export const PAGE_TYPE_ROUTES: Record<PageType, Route> = {
  dashboard: "/",
  nyregistreringer: "/nyregistreringer",
  populasjon: "/populasjon",
  pkk: "/pkk",
};

export interface DashboardFilters {
  segment: string | null;
}

export interface NyregistreringerFilters {
  segment: string | null;
  make: string | null;
  year: number;
}

export interface PopulasjonFilters {
  segment: string | null;
  make: string | null;
  district: string | null;
}

function readStringFilter(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readYearFilter(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getDashboardFilters(config: ReportViewConfig): DashboardFilters {
  return {
    segment: readStringFilter(config.filters?.segment),
  };
}

export function getNyregistreringerFilters(
  config: ReportViewConfig,
): NyregistreringerFilters {
  const currentYear = new Date().getFullYear();
  return {
    segment: readStringFilter(config.filters?.segment),
    make: readStringFilter(config.filters?.make),
    year: readYearFilter(config.filters?.year, currentYear),
  };
}

export function buildDashboardConfig(segment: string | null): ReportViewConfig {
  return {
    filters: {
      segment: segment ?? null,
    },
  };
}

export function getPopulasjonFilters(config: ReportViewConfig): PopulasjonFilters {
  return {
    segment: readStringFilter(config.filters?.segment),
    make: readStringFilter(config.filters?.make),
    district: readStringFilter(config.filters?.district),
  };
}

export function buildNyregistreringerConfig(
  filters: NyregistreringerFilters,
): ReportViewConfig {
  return {
    filters: {
      segment: filters.segment ?? null,
      make: filters.make ?? null,
      year: filters.year,
    },
  };
}

export function buildPopulasjonConfig(
  filters: PopulasjonFilters,
): ReportViewConfig {
  return {
    filters: {
      segment: filters.segment ?? null,
      make: filters.make ?? null,
      district: filters.district ?? null,
    },
  };
}

function readBooleanFilter(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return defaultValue;
}

function readMinFleetFilter(value: unknown): PkkMinFleet {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 5;
  return raw === 3 || raw === 10 || raw === 20 ? raw : 5;
}

function readPkkHorizon(value: unknown): PkkHorizon {
  return value === "upcoming" || value === "all" ? value : "actionable";
}

function readPkkParty(value: unknown): PkkCustomerParty {
  return value === "user" ? "user" : "owner";
}

function readRegionFilter(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : null;
}

export function getPkkFilters(config: ReportViewConfig): PkkFilters {
  const filters = config.filters ?? {};
  return {
    region: readRegionFilter(filters.region),
    minFleet: readMinFleetFilter(filters.minFleet),
    onlyFollowUp: readBooleanFilter(filters.onlyFollowUp, true),
    horizon: readPkkHorizon(filters.horizon),
    excludeFinance: readBooleanFilter(filters.excludeFinance, true),
    customerParty: readPkkParty(filters.customerParty),
    customerSearch: readStringFilter(filters.customerSearch),
  };
}

export function buildPkkConfig(filters: PkkFilters): ReportViewConfig {
  return {
    filters: {
      region: filters.region,
      minFleet: filters.minFleet,
      onlyFollowUp: filters.onlyFollowUp,
      horizon: filters.horizon,
      excludeFinance: filters.excludeFinance,
      customerParty: filters.customerParty,
      customerSearch: filters.customerSearch,
    },
  };
}

function pkkFiltersToSearchParams(filters: PkkFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("minFleet", String(filters.minFleet));
  params.set("horizon", filters.horizon);
  if (filters.region != null) params.set("region", String(filters.region));
  if (!filters.onlyFollowUp) params.set("followUp", "0");
  if (!filters.excludeFinance) params.set("excludeFinance", "0");
  if (filters.customerParty !== "owner") params.set("party", filters.customerParty);
  if (filters.customerSearch) params.set("q", filters.customerSearch);
  return params;
}

export function buildPageUrl(
  pageType: PageType,
  config: ReportViewConfig,
): Route {
  const base = PAGE_TYPE_ROUTES[pageType];
  const params = new URLSearchParams();

  if (pageType === "dashboard") {
    const { segment } = getDashboardFilters(config);
    if (segment) params.set("segment", segment);
  }

  if (pageType === "nyregistreringer") {
    const { segment, make, year } = getNyregistreringerFilters(config);
    if (segment) params.set("segment", segment);
    if (make) params.set("make", make);
    const currentYear = new Date().getFullYear();
    if (year !== currentYear) params.set("year", String(year));
  }

  if (pageType === "populasjon") {
    const { segment, make, district } = getPopulasjonFilters(config);
    if (segment) params.set("segment", segment);
    if (make) params.set("make", make);
    if (district) params.set("district", district);
  }

  if (pageType === "pkk") {
    return appendQuery(base, pkkFiltersToSearchParams(getPkkFilters(config)));
  }

  const query = params.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

function appendQuery(base: Route, params: URLSearchParams): Route {
  const query = params.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

export function describeReportViewConfig(
  pageType: PageType,
  config: ReportViewConfig,
): string {
  if (pageType === "dashboard") {
    const { segment } = getDashboardFilters(config);
    return segment ? `Segment: ${segment}` : "Alle segmenter · > 16t";
  }

  if (pageType === "nyregistreringer") {
    const { segment, make, year } = getNyregistreringerFilters(config);
    const parts = [`> 16t`, String(year)];
    if (segment) parts.push(segment);
    if (make) parts.push(make);
    return parts.join(" · ");
  }

  if (pageType === "populasjon") {
    const { segment, make, district } = getPopulasjonFilters(config);
    const parts = ["> 16t", "Bestand"];
    if (segment) parts.push(segment);
    if (make) parts.push(make);
    if (district) parts.push(district);
    return parts.join(" · ");
  }

  if (pageType === "pkk") {
    const filters = getPkkFilters(config);
    const parts = [
      pkkCustomerPartyLabel(filters.customerParty),
      PKK_MIN_FLEET_OPTIONS.find((opt) => opt.value === filters.minFleet)?.label ??
        `Min. ${filters.minFleet}`,
    ];
    const horizonLabel = PKK_HORIZON_OPTIONS.find(
      (opt) => opt.value === filters.horizon,
    )?.label;
    if (horizonLabel) parts.push(horizonLabel);
    if (filters.region != null) parts.push(`Region ${filters.region}`);
    if (!filters.onlyFollowUp) parts.push("Alle kunder");
    if (!filters.excludeFinance) parts.push("Inkl. finans");
    if (filters.customerSearch) parts.push(`Søk: ${filters.customerSearch}`);
    return parts.join(" · ");
  }

  return "Standardvisning";
}

export function isReportViewActive(
  pageType: PageType,
  config: ReportViewConfig,
  current: {
    segment?: string | null;
    make?: string | null;
    year?: number;
    district?: string | null;
    pkk?: PkkFilters;
  },
): boolean {
  if (pageType === "dashboard") {
    const { segment } = getDashboardFilters(config);
    return (segment ?? null) === (current.segment ?? null);
  }

  if (pageType === "nyregistreringer") {
    const saved = getNyregistreringerFilters(config);
    const currentYear = new Date().getFullYear();
    return (
      (saved.segment ?? null) === (current.segment ?? null) &&
      (saved.make ?? null) === (current.make ?? null) &&
      saved.year === (current.year ?? currentYear)
    );
  }

  if (pageType === "populasjon") {
    const saved = getPopulasjonFilters(config);
    return (
      (saved.segment ?? null) === (current.segment ?? null) &&
      (saved.make ?? null) === (current.make ?? null) &&
      (saved.district ?? null) === (current.district ?? null)
    );
  }

  if (pageType === "pkk" && current.pkk) {
    const saved = getPkkFilters(config);
    const active = current.pkk;
    return (
      saved.region === active.region &&
      saved.minFleet === active.minFleet &&
      saved.onlyFollowUp === active.onlyFollowUp &&
      saved.horizon === active.horizon &&
      saved.excludeFinance === active.excludeFinance &&
      saved.customerParty === active.customerParty &&
      (saved.customerSearch ?? null) === (active.customerSearch ?? null)
    );
  }

  return false;
}
