import { FLEET_DEALER_LABEL, type FleetFilter } from "@/lib/fleet";

export interface FocusShareParts {
  /** Rader som fleet-filteret inkluderer. */
  volume: number;
  /** Fokusmerke blant de inkluderte radene. */
  focus: number;
  /**
   * Alle rader i samme øvrige utvalg, uten fleet-filter.
   * Nevner for Volvo-andel når filteret er «fleet».
   */
  marketVolume: number;
}

/**
 * Volvo-andel på region-fanen.
 *
 * - all: fokus / alle rader.
 * - region: fokus / volum etter at Volvo Fleet og sentrale
 *   konkurrentorganisasjoner er trukket fra begge.
 * - fleet: fleet-volum / hele markedet. Fokus / volum er alltid 100 %
 *   fordi VIN-listen bare inneholder Volvo, og det tallet sier ingenting.
 */
export function focusSharePercent(
  filter: FleetFilter,
  parts: FocusShareParts,
): number {
  const denominator = filter === "fleet" ? parts.marketVolume : parts.volume;
  if (denominator <= 0) return 0;
  return (parts.focus / denominator) * 100;
}

/**
 * Andel av Norge. Teller og nevner bruker samme fleet-filter.
 * Region (og eventuelt måned i tabellen) ligger bare i telleren.
 */
export function nationalVolumeShare(
  volume: number,
  nationalVolume: number,
): number {
  if (nationalVolume <= 0) return 0;
  return (volume / nationalVolume) * 100;
}

export const FLEET_FILTER_SCOPE_COPY =
  "Valget gjelder hele fanen: nøkkeltall, utvikling mot i fjor, månedlig trend, merker, kjøpere, lojalitet og tabellene under.";

export const FLEET_REGION_COMPETITOR_NOTE =
  "Kun Region tar ut Volvo Fleet og konkurrentbiler der eier, bruker eller leasing står på listen over sentrale organisasjoner. Kundeavtaler solgt av en regional forhandler blir stående, fordi registreringen ikke viser salgskanal.";

export const FLEET_FILTER_DEFINITIONS: Record<FleetFilter, string> = {
  all: "Alle: hele markedet. Volvo-andel er Volvo av totalen. Andel av Norge er området av landet med samme filtre.",
  region: `Kun Region: Volvo Fleet (${FLEET_DEALER_LABEL}) og sentrale konkurrentorganisasjoner er tatt ut. Volvo-andel er gjenværende Volvo av det gjenværende markedet. Andel av Norge bruker samme utvalg nasjonalt. ${FLEET_REGION_COMPETITOR_NOTE}`,
  fleet: `Kun Fleet: bare Volvo registrert via Fleet Sales Norge (${FLEET_DEALER_LABEL}). Volumet er disse bilene. Volvo-andel er fleet mot hele markedet i samme utvalg, ikke 100 %. Andel av Norge er områdets fleet av landets fleet.`,
};

export const REGION_NO_SELECTION_NOTE =
  "Velg salgsregion i filterlinjen over for regionsspesifikke KPI-er og distriktsfordeling. Uten valgt region vises nasjonal oversikt og sammenligning mellom regioner.";

export const FLEET_RANKING_NOTE =
  "Andel er regionens fleet av landets fleet. Volvo-andel er fleet mot hele markedet i regionen, ikke 100 %.";

export const FLEET_DISTRICT_SHARE_NOTE =
  "Volvo-andel er fleet mot hele markedet i distriktet, ikke 100 %.";

export const FLEET_MONTH_SHARE_NOTE =
  "Prosenten på stolpen er fleet av hele markedet den måneden, ikke 100 %.";

export const FLEET_MAKE_SHARE_NOTE =
  "Kun Volvo ligger i fleet-listen. Prosenten er fleet av hele markedet i utvalget.";

export const FLEET_BUYER_SHARE_NOTE =
  "Andel er fleet av kjøperens kjøp i utvalget, ikke 100 %.";

export const FLEET_LOYALTY_NOTE =
  "Fleet-filteret gjelder kjøp i perioden. Tidligere historikk er ikke filtrert på fleet.";

export function fleetVolumeCaption(filter: FleetFilter): string | null {
  if (filter === "region") return "uten Volvo Fleet og sentrale konkurrenter";
  if (filter === "fleet") return "kun Volvo Fleet";
  return null;
}

export function fleetFocusShareCaption(filter: FleetFilter): string | null {
  if (filter === "region") return "Volvo uten fleet, av gjenværende marked";
  if (filter === "fleet") return "Fleet av hele markedet i utvalget";
  return null;
}

export function nationalShareCaption(
  filter: FleetFilter,
  nationalTotalLabel: string,
): string {
  if (filter === "region") {
    return `Av ${nationalTotalLabel} nasjonalt uten Volvo Fleet og sentrale konkurrenter`;
  }
  if (filter === "fleet") {
    return `Av ${nationalTotalLabel} fleet nasjonalt`;
  }
  return `Av ${nationalTotalLabel} nasjonalt`;
}
