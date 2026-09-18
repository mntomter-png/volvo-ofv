/**
 * Kommersielle ledende indikatorer: ordreinngang og tilbudsaktivitet.
 *
 * Registrering er levering, og levering ligger typisk 2–4 kvartaler etter
 * ordre. Uten et ledende signal så TMF-modellen ikke 2025 komme: markedet falt
 * 17 % og Volvo-andelen kollapset samtidig — 44,8 % feil på Volvo-volum.
 * Volvos egen ordreinngang er signalet som ville varslet det.
 *
 * Tallene er aggregerte YoY-prosenter som føres inn manuelt. Ingen volum,
 * kunder eller ordrelinjer forlater Volvos systemer.
 */

export const COMMERCIAL_KINDS = ["order_intake", "quote_activity"] as const;
export type TmfCommercialKind = (typeof COMMERCIAL_KINDS)[number];

export const COMMERCIAL_KIND_LABELS: Record<TmfCommercialKind, string> = {
  order_intake: "Ordreinngang",
  quote_activity: "Tilbudsaktivitet",
};

export const COMMERCIAL_KIND_DESCRIPTIONS: Record<TmfCommercialKind, string> = {
  order_intake:
    "Volvos ordreinngang mot samme periode året før. Ordre ligger 2–4 kvartaler foran levering, så dette er den sterkeste ledende indikatoren vi har.",
  quote_activity:
    "Tilbudsaktivitet mot samme periode året før. Leder ordreinngang, men konverteringsraten varierer. Brukes som bekreftende signal, ikke i tillegg til ordre.",
};

/**
 * Hvor mye av en prosentvis endring som slår gjennom i Volvo-volum neste år.
 *
 * Dette er skjønn, ikke estimert: med ett tall per år finnes det ikke nok
 * observasjoner til å estimere en koeffisient. Ordre blir til levering nesten
 * én-til-én over et år, men kanselleringer, kapasitet og forskyvning over
 * årsskiftet demper utslaget. Tilbud alene treffer svakere fordi
 * konverteringsraten svinger.
 *
 * Når begge er satt for samme år, blandes de — de adderes ikke. Tilbud som
 * konverterer blir ordre, så å summere de to ville telt samme pipeline to ganger.
 */
export const ORDER_PASS_THROUGH = 0.6;
export const QUOTE_ONLY_PASS_THROUGH = 0.3;
/** Andel av blended YoY som kommer fra tilbudsaktivitet når begge finnes. */
export const QUOTE_BLEND_WEIGHT = 0.25;

/** Maks samlet utslag på Volvo-volum, så et ekstremt innslag ikke velter prognosen. */
export const MAX_COMMERCIAL_EFFECT_PCT = 15;

export interface TmfCommercialIndicator {
  id: string;
  kind: TmfCommercialKind;
  periodYear: number;
  monthsCovered: number;
  yoyPct: number;
  note: string | null;
  updatedAt: string;
}

export interface TmfCommercialContribution {
  kind: TmfCommercialKind;
  label: string;
  periodYear: number;
  monthsCovered: number;
  yoyPct: number;
  /** Vekt i blended YoY (0–1). 1 når indikatoren brukes alene. */
  blendWeight: number;
  passThrough: number;
  /** Bidrag i prosent før samlet klipping. */
  rawEffectPct: number;
}

export interface TmfCommercialSignal {
  /** Multiplikator som legges på Volvo-volum (1 = ingen effekt). */
  multiplier: number;
  /** Samlet effekt i prosent etter klipping. */
  effectPct: number;
  /** Om effekten ble begrenset av taket. */
  clamped: boolean;
  /** Året signalet er hentet fra. */
  periodYear: number | null;
  contributions: TmfCommercialContribution[];
}

export const NEUTRAL_COMMERCIAL_SIGNAL: TmfCommercialSignal = {
  multiplier: 1,
  effectPct: 0,
  clamped: false,
  periodYear: null,
  contributions: [],
};

function isKind(value: string): value is TmfCommercialKind {
  return (COMMERCIAL_KINDS as readonly string[]).includes(value);
}

function latestOfKind(
  indicators: TmfCommercialIndicator[],
  kind: TmfCommercialKind,
  year: number,
): TmfCommercialIndicator | undefined {
  return indicators.find((item) => item.kind === kind && item.periodYear === year);
}

/**
 * Bygger Volvo-multiplikatoren fra de nyeste indikatortallene.
 *
 * Bruker det siste året som ligger på eller før `referenceYear` og som har
 * minst ett tall, slik at en prognose i september 2026 bruker 2026-YTD — ikke
 * et eldre tilbudstall blandet med et nyere ordretall.
 */
export function buildCommercialSignal(
  indicators: TmfCommercialIndicator[],
  referenceYear: number,
): TmfCommercialSignal {
  const usable = indicators.filter((item) => item.periodYear <= referenceYear);
  if (usable.length === 0) return NEUTRAL_COMMERCIAL_SIGNAL;

  const periodYear = Math.max(...usable.map((item) => item.periodYear));
  const order = latestOfKind(usable, "order_intake", periodYear);
  const quote = latestOfKind(usable, "quote_activity", periodYear);
  if (!order && !quote) return NEUTRAL_COMMERCIAL_SIGNAL;

  const contributions: TmfCommercialContribution[] = [];
  let blendedYoy: number;
  let passThrough: number;

  if (order && quote) {
    passThrough = ORDER_PASS_THROUGH;
    blendedYoy =
      (1 - QUOTE_BLEND_WEIGHT) * order.yoyPct + QUOTE_BLEND_WEIGHT * quote.yoyPct;
    contributions.push(
      toContribution(order, 1 - QUOTE_BLEND_WEIGHT, passThrough),
      toContribution(quote, QUOTE_BLEND_WEIGHT, passThrough),
    );
  } else if (order) {
    passThrough = ORDER_PASS_THROUGH;
    blendedYoy = order.yoyPct;
    contributions.push(toContribution(order, 1, passThrough));
  } else {
    passThrough = QUOTE_ONLY_PASS_THROUGH;
    blendedYoy = quote!.yoyPct;
    contributions.push(toContribution(quote!, 1, passThrough));
  }

  const rawEffectPct = blendedYoy * passThrough;
  const effectPct = Math.max(
    -MAX_COMMERCIAL_EFFECT_PCT,
    Math.min(MAX_COMMERCIAL_EFFECT_PCT, rawEffectPct),
  );

  return {
    multiplier: 1 + effectPct / 100,
    effectPct,
    clamped: Math.abs(rawEffectPct - effectPct) > 0.001,
    periodYear,
    contributions,
  };
}

function toContribution(
  indicator: TmfCommercialIndicator,
  blendWeight: number,
  passThrough: number,
): TmfCommercialContribution {
  return {
    kind: indicator.kind,
    label: COMMERCIAL_KIND_LABELS[indicator.kind],
    periodYear: indicator.periodYear,
    monthsCovered: indicator.monthsCovered,
    yoyPct: indicator.yoyPct,
    blendWeight,
    passThrough,
    rawEffectPct: indicator.yoyPct * blendWeight * passThrough,
  };
}

export function normalizeCommercialKind(value: unknown): TmfCommercialKind | null {
  return typeof value === "string" && isKind(value) ? value : null;
}

/**
 * Leser et manuelt prosentfelt. Godtar komma, punktum, fortegn og %-tegn,
 * slik at −8,5 og 10% begge blir et tall. Tomt eller ufullstendig utkast
 * (f.eks. bare minus) gir null, så feltet kan tømmes bevisst.
 */
export function parseYoyPctInput(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw)
    .trim()
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (text === "" || text === "-" || text === "+" || text === "." || text === "-." || text === "+.") {
    return null;
  }
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return null;
  return Math.max(-100, Math.min(200, value));
}
