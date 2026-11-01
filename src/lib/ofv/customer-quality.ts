/**
 * Kundekvalitet for Kjøpere, lojalitet, Kundeutvikling og Potensial.
 * Speiler SQL-funksjonene i migrasjonen customer_party_quality:
 * ofv_is_placeholder_party, ofv_is_finance_or_importer, ofv_is_dealer_party,
 * ofv_is_channel_party.
 */

/** Første år med tunge nyregistreringer i OFV-datasettet. */
export const HEAVY_REGISTRATION_HISTORY_START = "2020-01-01";

/**
 * Visningsstart for «siden 2020». Lookback i SQL er 10 år, men det finnes
 * ikke rader før 2020, så datoer før det klemmes til datasettets start.
 */
export function displayedHistoryStart(lookbackStart: string): string {
  return lookbackStart < HEAVY_REGISTRATION_HISTORY_START
    ? HEAVY_REGISTRATION_HISTORY_START
    : lookbackStart;
}

/** Default true (skjul kanal). ?excludeChannel=0 viser finans, importør og forhandler. */
export function parseExcludeChannel(
  value: string | string[] | undefined,
): boolean {
  const raw = Array.isArray(value) ? value : [value];
  return !raw.some((item) => item === "0" || item === "false");
}

/**
 * Plassholder: org.nr. mangler og navnet er tomt eller nøyaktig «Ukjent».
 * Et org.nr. gjør parten til en kunde selv om navnet er tomt.
 */
export function isPlaceholderParty(
  name: string | null | undefined,
  orgnr: string | null | undefined,
): boolean {
  if ((orgnr ?? "").trim().length > 0) return false;
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized === "" || normalized === "ukjent";
}

/**
 * Finans/leasing eller merkeimportør.
 * Matcher ikke merkeordet alene (f.eks. et holdingsnavn med «Volvo») og
 * ikke holdingselskap bare fordi navnet inneholder et kapital-ord.
 */
const FINANCE_OR_IMPORTER =
  /finans|leasing|finance|kredit|nordea|handelsbank|santander|de lage landen|caterpillar financial|bnp paribas|resurs|fleet management|ayvens|danske bank|sparebank|\bdnb\b|volvo\s+(finans|norge|truck|trucks|group|lastvagn|maskin)|norsk\s+scania|scania\s+(norge|finans|finance)|man\s+truck|daf\s+truck|\biveco\b|mercedes[\s-]?benz|renault\s*trucks|\btraton\b|bertel\s+o\.?\s*steen|\bsany\b|\bisuzu\b|\bmitsubishi\b/i;

export function isFinanceOrImporter(name: string | null | undefined): boolean {
  return FINANCE_OR_IMPORTER.test(name ?? "");
}

/**
 * Forhandler som registrerer lager i eget navn.
 * Navn som slutter på ordet «bil», Nordren, Trucknor, trucks & buses,
 * lastebil og buss, motorsenter / lastebilsenter / truckcenter / forhandler.
 * «Bilruter», «bildrift» og «lastebiltransport» er driftsselskaper og treffer ikke.
 */
const DEALER =
  /(^|\s)bil(\s+(as|asa))?$|\bnordren\b|\btrucknor\b|trucks\s*(&|og|and)\s*buses|lastebil\s+og\s+buss|motorsenter|lastebilsenter|lastebil\s*senter|truckcenter|truck\s*center|\bforhandler\b/i;

export function isDealerParty(name: string | null | undefined): boolean {
  return DEALER.test(name ?? "");
}

/** Finans, importør eller forhandler. Default skjules på toppkjøperlisten. */
export function isChannelParty(name: string | null | undefined): boolean {
  return isFinanceOrImporter(name) || isDealerParty(name);
}
