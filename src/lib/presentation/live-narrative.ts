import { formatNumber, formatPercent } from "@/lib/format";
import {
  SLIDE_TITLES,
  type SlideNarrative,
} from "@/lib/presentation/narrative";
import type {
  BodyworkFuelShare,
  FlowStockShare,
  HpShareRow,
  LoyaltySummary,
  MakeSharePeriod,
  NamedCount,
  PresentationDeckData,
  RegionShareRow,
  SegmentMakeShare,
  TmfNextYearSummary,
  TmfSegmentForecastRow,
  YearVolume,
} from "@/lib/presentation/queries";

function pct(share: number, decimals = 1): string {
  return `${formatPercent(share * 100, decimals)} %`;
}

function makeShare(
  rows: NamedCount[],
  make: string,
): { count: number; share: number; total: number } {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const count = rows.find((row) => row.name === make)?.count ?? 0;
  return { count, share: total > 0 ? count / total : 0, total };
}

function periodByYear(
  periods: MakeSharePeriod[],
  year: number,
): MakeSharePeriod | undefined {
  return periods.find((period) => period.year === year);
}

function ytdPeriod(periods: MakeSharePeriod[]): MakeSharePeriod | undefined {
  return periods.find((period) => period.label.startsWith("YTD"));
}

function annualRunRate(ytdCount: number, ytdTo: string): number {
  const month = Number.parseInt(ytdTo.slice(5, 7), 10);
  if (!Number.isFinite(month) || month <= 0) return ytdCount;
  return Math.round((ytdCount / month) * 12);
}

function topN(rows: NamedCount[], n: number): string {
  return rows
    .slice(0, n)
    .map((row) => `${row.name} ${formatNumber(row.count)}`)
    .join(" · ");
}

function strongestElectric(
  rows: BodyworkFuelShare[],
): BodyworkFuelShare | undefined {
  return [...rows].sort((a, b) => b.electricShare - a.electricShare)[0];
}

function strongestGas(rows: BodyworkFuelShare[]): BodyworkFuelShare | undefined {
  return [...rows].sort((a, b) => b.gasShare - a.gasShare)[0];
}

function largestSegment(rows: SegmentMakeShare[]): SegmentMakeShare | undefined {
  return [...rows].sort((a, b) => b.total - a.total)[0];
}

function biggestGap(
  rows: SegmentMakeShare[],
  focusMake: string,
): SegmentMakeShare | undefined {
  const withGap = rows.filter(
    (row) =>
      row.topCompetitor &&
      row.topCompetitor !== focusMake &&
      row.topCompetitorShare > row.focusShare,
  );
  return [...withGap].sort(
    (a, b) =>
      b.topCompetitorShare - b.focusShare - (a.topCompetitorShare - a.focusShare),
  )[0];
}

function volumeBullets(
  volumeByYear: YearVolume[],
  currentYear: number,
  ytdTo: string,
  tmfAnnualForecast: number | null,
  tmfScenarioLabel: string | null,
): string[] {
  const bullets: string[] = [];
  const peak = [...volumeByYear].sort((a, b) => b.count - a.count)[0];
  if (peak) {
    bullets.push(
      `Høyeste år i utvalget: ${peak.year} med ${formatNumber(peak.count)} enheter.`,
    );
  }

  const prevFull = volumeByYear.find(
    (row) => row.year === currentYear - 1 && !row.partial,
  );
  if (prevFull) {
    bullets.push(
      `${prevFull.year}: ${formatNumber(prevFull.count)} enheter totalt.`,
    );
  }

  const ytd = volumeByYear.find((row) => row.year === currentYear);
  if (ytd) {
    bullets.push(
      `${currentYear} YTD (t.o.m. ${ytdTo}): ${formatNumber(ytd.count)} enheter.`,
    );
    if (tmfAnnualForecast != null) {
      bullets.push(
        `TMF årsprognose ${currentYear} (${tmfScenarioLabel ?? "Basis"}): ${formatNumber(tmfAnnualForecast)} enheter.`,
      );
    } else if (ytd.partial) {
      bullets.push(
        `Årstakt ca. ${formatNumber(annualRunRate(ytd.count, ytdTo))} enheter.`,
      );
    }
  }

  if (ytd && prevFull && prevFull.count > 0) {
    const compareValue =
      tmfAnnualForecast ?? runRateOrCount(ytd, ytdTo);
    const delta = (compareValue - prevFull.count) / prevFull.count;
    const label =
      tmfAnnualForecast != null ? "Prognose" : "Årstakt";
    bullets.push(
      `${label} vs ${prevFull.year}: ${delta >= 0 ? "+" : ""}${formatPercent(delta * 100, 1)} %.`,
    );
  }

  return bullets;
}

function runRateOrCount(row: YearVolume, ytdTo: string): number {
  return row.partial ? annualRunRate(row.count, ytdTo) : row.count;
}

function makeShareBullets(
  periods: MakeSharePeriod[],
  focusMake: string,
  currentYear: number,
): string[] {
  const bullets: string[] = [];
  const ytd = ytdPeriod(periods);
  const base2019 = periodByYear(periods, 2019);
  const prev = periodByYear(periods, currentYear - 1);

  if (ytd) {
    const focus = makeShare(ytd.rows, focusMake);
    const leader = ytd.rows[0];
    bullets.push(
      `${ytd.label}: ${focusMake} ${pct(focus.share)} (${formatNumber(focus.count)} av ${formatNumber(ytd.total)}).`,
    );
    if (leader && leader.name !== focusMake) {
      bullets.push(
        `Største merke YTD: ${leader.name} med ${pct(leader.count / ytd.total)}.`,
      );
    }
  }

  if (prev) {
    const focus = makeShare(prev.rows, focusMake);
    bullets.push(
      `${prev.year}: ${focusMake} ${pct(focus.share)} av ${formatNumber(prev.total)} enheter.`,
    );
  }

  if (base2019 && ytd) {
    const then = makeShare(base2019.rows, focusMake);
    const now = makeShare(ytd.rows, focusMake);
    const deltaPp = (now.share - then.share) * 100;
    bullets.push(
      `${focusMake} vs 2019: ${pct(then.share)} → ${pct(now.share)} (${deltaPp >= 0 ? "+" : ""}${formatPercent(deltaPp, 1)} pp).`,
    );
  }

  return bullets;
}

function segmentBullets(
  segments: SegmentMakeShare[],
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  const largest = largestSegment(segments);
  if (largest) {
    bullets.push(
      `Største segment YTD: ${largest.label} med ${formatNumber(largest.total)} enheter (${focusMake} ${pct(largest.focusShare, 0)}).`,
    );
  }

  const leaders = [...segments]
    .filter((row) => row.focusShare >= 0.4)
    .sort((a, b) => b.focusShare - a.focusShare)
    .slice(0, 2);
  if (leaders.length > 0) {
    bullets.push(
      `${focusMake} høyest andel i: ${leaders
        .map((row) => `${row.label} ${pct(row.focusShare, 0)}`)
        .join(" · ")}.`,
    );
  }

  const gap = biggestGap(segments, focusMake);
  if (gap?.topCompetitor) {
    bullets.push(
      `Størst gap mot konkurrent: ${gap.label} — ${focusMake} ${pct(gap.focusShare, 0)} vs ${gap.topCompetitor} ${pct(gap.topCompetitorShare, 0)}.`,
    );
  }

  return bullets;
}

function fuelBullets(
  data: Pick<PresentationDeckData, "fuelMix" | "fossilFreeShare" | "periodLabel">,
): string[] {
  const bullets: string[] = [];
  const diesel = data.fuelMix.find((row) => /diesel/i.test(row.fuel));
  const electric = data.fuelMix.find((row) => /elektr/i.test(row.fuel));
  const gas = data.fuelMix.find((row) => /gass/i.test(row.fuel));

  bullets.push(
    `${data.periodLabel}: fossilfri andel (el + gass) ${pct(data.fossilFreeShare)}.`,
  );
  if (diesel) {
    bullets.push(`Diesel: ${pct(diesel.share)} (${formatNumber(diesel.count)} enheter).`);
  }
  if (electric) {
    bullets.push(
      `Elektrisitet: ${pct(electric.share)} (${formatNumber(electric.count)} enheter).`,
    );
  }
  if (gas) {
    bullets.push(`Gass: ${pct(gas.share)} (${formatNumber(gas.count)} enheter).`);
  }
  return bullets;
}

function electricSegmentBullets(rows: BodyworkFuelShare[]): string[] {
  const bullets: string[] = [];
  const top = strongestElectric(rows.filter((row) => row.total > 0));
  if (top) {
    bullets.push(
      `Høyest el-andel: ${top.label} med ${pct(top.electricShare)} (${formatNumber(top.electricCount)} av ${formatNumber(top.total)}).`,
    );
  }

  const ranked = [...rows]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.electricShare - a.electricShare);
  for (const row of ranked.slice(0, 3)) {
    if (row === top) continue;
    bullets.push(
      `${row.label}: ${pct(row.electricShare)} el (${formatNumber(row.electricCount)} enheter).`,
    );
  }
  return bullets.slice(0, 4);
}

function gasBullets(
  rows: BodyworkFuelShare[],
  gasMakeShare: MakeSharePeriod,
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  const top = strongestGas(rows.filter((row) => row.total > 0));
  if (top) {
    bullets.push(
      `Høyest gassandel: ${top.label} med ${pct(top.gasShare)} (${formatNumber(top.gasCount)} av ${formatNumber(top.total)}).`,
    );
  }

  for (const row of [...rows]
    .filter((row) => row.total > 0 && row !== top)
    .sort((a, b) => b.gasShare - a.gasShare)
    .slice(0, 2)) {
    bullets.push(
      `${row.label}: ${pct(row.gasShare)} gass (${formatNumber(row.gasCount)} enheter).`,
    );
  }

  if (gasMakeShare.total > 0) {
    const focus = makeShare(gasMakeShare.rows, focusMake);
    const leader = gasMakeShare.rows[0];
    bullets.push(
      `Gassmarkedet YTD: ${focusMake} ${pct(focus.share)}` +
        (leader
          ? ` · største merke ${leader.name} ${pct(leader.count / gasMakeShare.total)}.`
          : "."),
    );
  }

  return bullets;
}

function bevCompetitionBullets(
  electricByYear: YearVolume[],
  electricMakeShare: MakeSharePeriod,
  electricByBodywork: BodyworkFuelShare[],
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  const series = electricByYear
    .map((row) => `${row.year}: ${formatNumber(row.count)}`)
    .join(" → ");
  if (series) {
    bullets.push(`El-volum per år: ${series}.`);
  }

  if (electricMakeShare.total > 0) {
    const focus = makeShare(electricMakeShare.rows, focusMake);
    bullets.push(
      `El merkeandel YTD: ${focusMake} ${pct(focus.share)} (${formatNumber(focus.count)} av ${formatNumber(electricMakeShare.total)}).`,
    );
    const others = electricMakeShare.rows
      .filter((row) => row.name !== focusMake)
      .slice(0, 3);
    if (others.length > 0) {
      bullets.push(`Øvrige el-merker YTD: ${topN(others, 3)}.`);
    }
  }

  const strongholds = [...electricByBodywork]
    .filter((row) => row.electricCount > 0 && row.electricShare >= 0.5)
    .sort((a, b) => b.electricShare - a.electricShare)
    .slice(0, 3);
  if (strongholds.length > 0) {
    bullets.push(
      `Segmenter med høy el-andel: ${strongholds
        .map((row) => `${row.label} ${pct(row.electricShare, 0)}`)
        .join(" · ")}.`,
    );
  }

  return bullets;
}

function flowStockBullets(
  flowStock: FlowStockShare,
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  bullets.push(
    `Nyregistrering (flow) YTD: ${focusMake} ${pct(flowStock.flowShare)} (${formatNumber(flowStock.flowFocusCount)} av ${formatNumber(flowStock.flowTotal)}).`,
  );
  bullets.push(
    `Park (stock): ${focusMake} ${pct(flowStock.stockShare)} (${formatNumber(flowStock.stockFocusCount)} av ${formatNumber(flowStock.stockTotal)}).`,
  );
  const gap = flowStock.flowShare - flowStock.stockShare;
  bullets.push(
    `Gap flow vs park: ${gap >= 0 ? "+" : ""}${formatPercent(gap * 100, 1)} prosentpoeng.`,
  );
  return bullets;
}

function regionBullets(
  regionShares: RegionShareRow[],
  nationalFocusShare: number,
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  bullets.push(
    `Nasjonal ${focusMake}-andel YTD: ${pct(nationalFocusShare)}.`,
  );
  if (regionShares.length === 0) return bullets;

  const strongest = regionShares[0];
  const weakest = [...regionShares].sort(
    (a, b) => a.focusShare - b.focusShare || a.count - b.count,
  )[0];
  if (strongest) {
    bullets.push(
      `Sterkest region: ${strongest.label} med ${pct(strongest.focusShare)} (${formatNumber(strongest.focusCount)} av ${formatNumber(strongest.count)}).`,
    );
  }
  if (weakest && weakest.region !== strongest?.region) {
    bullets.push(
      `Svakest region: ${weakest.label} med ${pct(weakest.focusShare)}.`,
    );
  }
  const above = regionShares.filter((row) => row.focusShare > nationalFocusShare);
  if (above.length > 0) {
    bullets.push(
      `Over nasjonalt nivå: ${above.map((row) => `R${row.region}`).join(", ")}.`,
    );
  }
  return bullets;
}

function hpBullets(hpShares: HpShareRow[], focusMake: string): string[] {
  const bullets: string[] = [];
  const total = hpShares.reduce((sum, row) => sum + row.count, 0);
  const focusTotal = hpShares.reduce((sum, row) => sum + row.focusCount, 0);
  if (total > 0) {
    bullets.push(
      `Samlet ${focusMake}-andel i HK-mix YTD: ${pct(focusTotal / total)}.`,
    );
  }
  const byVolume = [...hpShares].sort((a, b) => b.count - a.count);
  const largest = byVolume[0];
  if (largest) {
    bullets.push(
      `Største effektklasse: ${largest.label} med ${formatNumber(largest.count)} enheter (${pct(largest.focusShare)} ${focusMake}).`,
    );
  }
  const byShare = [...hpShares]
    .filter((row) => row.count >= 20)
    .sort((a, b) => b.focusShare - a.focusShare);
  const best = byShare[0];
  if (best) {
    bullets.push(
      `Høyeste ${focusMake}-andel (≥20 enh.): ${best.label} med ${pct(best.focusShare)}.`,
    );
  }
  return bullets;
}

function loyaltyBullets(
  loyalty: LoyaltySummary,
  focusMake: string,
): string[] {
  const bullets: string[] = [];
  const totalOwners =
    loyalty.repeat.owners + loyalty.new.owners + loyalty.conquest.owners;
  const totalPurchases =
    loyalty.repeat.purchases +
    loyalty.new.purchases +
    loyalty.conquest.purchases;

  bullets.push(
    `Gjentakskjøpere: ${formatNumber(loyalty.repeat.owners)} eiere · ${formatNumber(loyalty.repeat.purchases)} kjøp.`,
  );
  bullets.push(
    `Nye ${focusMake}-kjøpere: ${formatNumber(loyalty.new.owners)} eiere · ${formatNumber(loyalty.new.purchases)} kjøp.`,
  );
  bullets.push(
    `Conquest: ${formatNumber(loyalty.conquest.owners)} eiere · ${formatNumber(loyalty.conquest.purchases)} kjøp.`,
  );
  if (totalOwners > 0) {
    bullets.push(
      `Fordeling eiere: gjentak ${pct(loyalty.repeat.owners / totalOwners, 0)} · nye ${pct(loyalty.new.owners / totalOwners, 0)} · conquest ${pct(loyalty.conquest.owners / totalOwners, 0)} (${formatNumber(totalPurchases)} kjøp totalt).`,
    );
  }
  return bullets;
}

function tmfNextYearBullets(
  next: TmfNextYearSummary | null,
  currentYear: number,
  tmfAnnualForecast: number | null,
): string[] {
  if (!next) {
    return ["TMF-prognose for neste år er ikke tilgjengelig."];
  }
  const bullets = [
    `${next.year} marked (P50, ${next.scenarioLabel}): ${formatNumber(next.annualMarket)} enheter.`,
    `Fokusmerke-estimat: ${formatNumber(next.annualVolvo)} (${formatPercent(next.volvoSharePct, 1)} % andel).`,
    `Elektrisk andel i prognosen: ${formatPercent(next.emobSharePct, 1)} % (${formatNumber(next.annualEmob)} enheter).`,
    `Usikkerhetsbånd marked: ${formatNumber(next.marketP10)}–${formatNumber(next.marketP90)}.`,
  ];
  if (tmfAnnualForecast != null && tmfAnnualForecast > 0) {
    const delta =
      ((next.annualMarket - tmfAnnualForecast) / tmfAnnualForecast) * 100;
    bullets.push(
      `Vs TMF ${currentYear}: ${delta >= 0 ? "+" : ""}${formatPercent(delta, 1)} %.`,
    );
  }
  return bullets;
}

function tmfSegmentBullets(rows: TmfSegmentForecastRow[]): string[] {
  if (rows.length === 0) {
    return ["Segmentprognose er ikke tilgjengelig."];
  }
  const bullets: string[] = [];
  const top = rows[0];
  if (top) {
    bullets.push(
      `Største segment neste år: ${top.label} med ${formatNumber(top.annualMarket)} enheter.`,
    );
  }
  const byShare = [...rows].sort((a, b) => b.volvoSharePct - a.volvoSharePct);
  const best = byShare[0];
  if (best) {
    bullets.push(
      `Høyeste fokusmerke-andel: ${best.label} med ${formatPercent(best.volvoSharePct, 1)} %.`,
    );
  }
  const byEmob = [...rows].sort((a, b) => b.emobSharePct - a.emobSharePct);
  const emobLead = byEmob[0];
  if (emobLead && emobLead.emobSharePct > 0) {
    bullets.push(
      `Høyeste el-andel: ${emobLead.label} med ${formatPercent(emobLead.emobSharePct, 1)} %.`,
    );
  }
  return bullets;
}

/** Nøytrale innsiktspunkter fylt med live OFV-tall. */
export function buildLiveNarratives(
  data: Omit<PresentationDeckData, "narratives" | "meta" | "error">,
): SlideNarrative[] {
  const byId: Record<string, string[]> = {
    title: [],
    "market-volume": volumeBullets(
      data.volumeByYear,
      data.currentYear,
      data.ytdTo,
      data.tmfAnnualForecast,
      data.tmfScenarioLabel,
    ),
    "make-share": makeShareBullets(
      data.makeSharePeriods,
      data.focusMake,
      data.currentYear,
    ),
    "flow-vs-stock": flowStockBullets(data.flowStock, data.focusMake),
    regions: regionBullets(
      data.regionShares,
      data.nationalFocusShare,
      data.focusMake,
    ),
    segments: segmentBullets(data.segmentShares, data.focusMake),
    "hp-mix": hpBullets(data.hpShares, data.focusMake),
    loyalty: loyaltyBullets(data.loyalty, data.focusMake),
    driveline: fuelBullets(data),
    "bev-segments": electricSegmentBullets(data.electricByBodywork),
    gas: gasBullets(data.gasByBodywork, data.gasMakeShare, data.focusMake),
    "bev-competition": bevCompetitionBullets(
      data.electricByYear,
      data.electricMakeShare,
      data.electricByBodywork,
      data.focusMake,
    ),
    "tmf-next-year": tmfNextYearBullets(
      data.tmfNextYear,
      data.currentYear,
      data.tmfAnnualForecast,
    ),
    "tmf-segments": tmfSegmentBullets(data.tmfSegmentForecast),
  };

  return SLIDE_TITLES.map((slide) => ({
    id: slide.id,
    title: slide.title,
    bullets: byId[slide.id] ?? [],
  }));
}
