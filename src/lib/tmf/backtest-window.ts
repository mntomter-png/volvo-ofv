/**
 * Felles definisjon av backtest-vinduet, slik at backtest og SSB-kalibrering
 * måler samme modell som faktisk leveres.
 *
 * Den levende prognosen lages ved en gitt dato og gjelder neste kalenderår.
 * En ærlig backtest av målår Y må derfor kjøres fra samme måned i år Y−1 —
 * ikke fra 1. januar i år Y, som gir et kortere og lettere prognosehorisont
 * og aldri aktiverer YTD-momentum.
 */

/** Referansedato som speiler hvordan prognosen lages: samme måned året før målåret. */
export function asOfReferenceForTargetYear(targetYear: number, asOfMonth: number): Date {
  return new Date(targetYear - 1, asOfMonth - 1, 1);
}

/**
 * Første målår der hele trailing-12-vinduet ligger innenfor datagrunnlaget.
 * Baseline for målår Y starter i (Y−2), så vi trenger to hele år med historikk.
 */
export function firstAsOfBacktestYear(minDataYear: number): number {
  return minDataYear + 2;
}

/** Målår vi kan sammenligne mot faktisk: til og med siste fullførte kalenderår. */
export function lastAsOfBacktestYear(reference: Date): number {
  return reference.getFullYear() - 1;
}

export function asOfBacktestYears(minDataYear: number, reference: Date): number[] {
  const first = firstAsOfBacktestYear(minDataYear);
  const last = lastAsOfBacktestYear(reference);
  const years: number[] = [];
  for (let year = first; year <= last; year += 1) years.push(year);
  return years;
}
