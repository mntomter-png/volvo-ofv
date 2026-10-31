/**
 * Nøkkel for cachet TMF-backtest og kalibrering.
 *
 * Selve prognosen (scenario, manuelle justeringer, ordre og fornyelse) regnes
 * fortsatt per forespørsel. Det som caches er rutenettet over historikken, og
 * det avhenger av registreringene, SSB-serien og hvilken kalenderdag vi står på.
 */

export interface TmfModelCacheKeyInput {
  /** Siste fullførte OFV-synk som skrev nyregistreringer. */
  dataVersion: number;
  /** completed_at for siste SSB-synk, eller null når SSB aldri er synket. */
  ssbSyncedAt: string | null;
  /** Lokal kalenderdag `yyyy-MM-dd`, samme sone som `Date#getFullYear`. */
  day: string;
  focusMake: string;
}

export function tmfModelCacheKey(input: TmfModelCacheKeyInput): string {
  return [
    String(input.dataVersion),
    input.ssbSyncedAt ?? "no-ssb",
    input.day,
    input.focusMake,
  ].join("|");
}

export function tmfModelDayKey(reference: Date): string {
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${reference.getFullYear()}-${month}-${day}`;
}

/**
 * Midt på dagen lokal tid. Modellene bruker bare år og måned, og historikk-
 * vinduet bruker kalenderdagen. Klokkeslettet i nøkkelen skal ikke endre tallene.
 */
export function referenceFromDayKey(day: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) {
    throw new Error(`Ugyldig TMF-cachedag: ${day}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  return new Date(year, month - 1, date, 12, 0, 0, 0);
}
