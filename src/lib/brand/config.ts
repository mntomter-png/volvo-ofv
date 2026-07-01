/** Støttede merkevare-kontekster (fokusmerke i tall og UI). */
export const BRAND_IDS = ["volvo", "renault"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export interface BrandConfig {
  id: BrandId;
  /** Eksakt make_name i OFV-data. */
  makeName: string;
  shortName: string;
  appTitle: string;
  appTagline: string;
  shareLabel: string;
  footerOrg: string;
  /** Salgsregioner er basert på Volvos forhandlernett – skjul for andre merker. */
  showDealerRegions: boolean;
  chartPrimary: string;
  chartAccent: string;
  chartPrimaryDim: string;
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  volvo: {
    id: "volvo",
    makeName: "Volvo",
    shortName: "Volvo",
    appTitle: "Volvo OFV",
    appTagline: "Trucks · Norge",
    shareLabel: "Volvo-andel",
    footerOrg: "Volvo Group",
    showDealerRegions: true,
    chartPrimary: "oklch(0.36 0.16 264)",
    chartAccent: "oklch(0.87 0.17 95)",
    chartPrimaryDim: "oklch(0.36 0.16 264 / 0.35)",
  },
  renault: {
    id: "renault",
    makeName: "Renault",
    shortName: "Renault",
    appTitle: "Renault OFV",
    appTagline: "Trucks · Norge",
    shareLabel: "Renault-andel",
    footerOrg: "Renault Trucks",
    showDealerRegions: false,
    chartPrimary: "oklch(0.28 0.02 260)",
    chartAccent: "oklch(0.78 0.17 88)",
    chartPrimaryDim: "oklch(0.28 0.02 260 / 0.35)",
  },
};

export const DEFAULT_BRAND_ID: BrandId = "volvo";

export const BRAND_FILTER_OPTIONS = BRAND_IDS.map((id) => ({
  value: id,
  label: BRANDS[id].shortName,
}));

export function getBrandConfig(id: BrandId): BrandConfig {
  return BRANDS[id];
}

export function resolveBrandId(raw: unknown): BrandId {
  if (raw === "renault") return "renault";
  return DEFAULT_BRAND_ID;
}
