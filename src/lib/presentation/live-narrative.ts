import { formatNumber, formatPercent } from "@/lib/format";
import {
  SLIDE_TITLES,
  type SlideNarrative,
} from "@/lib/presentation/narrative";
import type {
  BodyworkFuelShare,
  MakeSharePeriod,
  NamedCount,
  PresentationDeckData,
  SegmentMakeShare,
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
    const runRate = annualRunRate(ytd.count, ytdTo);
    bullets.push(
      `${currentYear} YTD (t.o.m. ${ytdTo}): ${formatNumber(ytd.count)} enheter` +
        (ytd.partial ? ` · årstakt ca. ${formatNumber(runRate)}.` : "."),
    );
  }

  if (ytd && prevFull && prevFull.count > 0) {
    const delta = (runRateOrCount(ytd, ytdTo) - prevFull.count) / prevFull.count;
    bullets.push(
      `Årstakt vs ${prevFull.year}: ${delta >= 0 ? "+" : ""}${formatPercent(delta * 100, 1)} %.`,
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
    ),
    "make-share": makeShareBullets(
      data.makeSharePeriods,
      data.focusMake,
      data.currentYear,
    ),
    segments: segmentBullets(data.segmentShares, data.focusMake),
    driveline: fuelBullets(data),
    "bev-segments": electricSegmentBullets(data.electricByBodywork),
    gas: gasBullets(data.gasByBodywork, data.gasMakeShare, data.focusMake),
    "bev-competition": bevCompetitionBullets(
      data.electricByYear,
      data.electricMakeShare,
      data.electricByBodywork,
      data.focusMake,
    ),
  };

  return SLIDE_TITLES.map((slide) => ({
    id: slide.id,
    title: slide.title,
    bullets: byId[slide.id] ?? [],
  }));
}
