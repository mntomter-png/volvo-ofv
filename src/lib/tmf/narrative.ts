import { formatNumber, formatPercent } from "@/lib/format";
import { TMF_DRIVER_LABELS } from "@/lib/ssb/indicators";
import type { TmfEstimateResult } from "@/lib/tmf/types";

export interface TmfNarrative {
  headline: string;
  lead: string;
  bullets: string[];
  caveats: string[];
}

function signedPct(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, decimals)} %`;
}

/**
 * Bygger en lesbar oppsummering av hvorfor neste års markedspotensial
 * endrer seg vs. inneværende års justerte prognose.
 */
export function buildTmfNarrative(estimate: TmfEstimateResult): TmfNarrative {
  const { currentYear, nextYear, scenarioLabel, calibration, confidence, driverIndices } =
    estimate;

  const currentMarket = currentYear.total.annualAdjustedForecast;
  const nextMarket = nextYear.total.annualMarket;
  const deltaPct = currentMarket > 0 ? ((nextMarket - currentMarket) / currentMarket) * 100 : 0;

  const headline =
    deltaPct <= -3
      ? `Modellen peker mot nedgang i markedspotensialet for ${nextYear.year}`
      : deltaPct >= 3
        ? `Modellen peker mot oppgang i markedspotensialet for ${nextYear.year}`
        : `Modellen peker mot stabilt markedspotensial for ${nextYear.year}`;

  const lead = `${nextYear.year} er estimert til ${formatNumber(Math.round(nextMarket))} nyregistreringer (P50), ${signedPct(deltaPct)} mot prognosen for ${currentYear.year} (${formatNumber(Math.round(currentMarket))}). Volvo-estimatet er ${formatNumber(Math.round(nextYear.total.annualVolvo))} (${formatPercent(nextYear.total.volvoSharePct, 1)} % andel). Drivlinje: EMOB ${formatPercent(nextYear.total.emobSharePct, 1)} % (${formatNumber(Math.round(nextYear.total.annualEmob))}) / ICE ${formatNumber(Math.round(nextYear.total.annualIce))}. Usikkerhetsbåndet ligger på ${formatNumber(Math.round(confidence.market.p10))}–${formatNumber(Math.round(confidence.market.p90))}.`;

  const bullets: string[] = [];

  bullets.push(
    `Utgangspunktet er siste 12 måneders OFV-nivå, justert for sesong, deretter videre for ${nextYear.year} med trend, SSB-signal og scenario (${scenarioLabel}).`,
  );

  const trendDrivers = nextYear.segments
    .map((segment) => ({
      label: segment.label,
      cagr: segment.trend.cagrPct,
      historical: segment.trend.historicalCagrPct,
      ytd: segment.trend.ytdMomentumPct,
      ytdWeight: segment.trend.ytdWeight,
    }))
    .filter((segment) => Math.abs(segment.cagr) >= 0.5 || (segment.ytd != null && Math.abs(segment.ytd) >= 5))
    .sort((a, b) => a.cagr - b.cagr);

  if (nextYear.trendApplied && trendDrivers.length > 0) {
    const withYtd = trendDrivers.filter((s) => s.ytd != null && s.ytdWeight > 0);
    if (withYtd.length > 0) {
      bullets.push(
        `Trend er blend av historisk CAGR og YTD-momentum (vekt ${(withYtd[0]!.ytdWeight * 100).toFixed(0)} % YTD): ${withYtd
          .map(
            (s) =>
              `${s.label} effektiv ${signedPct(s.cagr)} (hist ${signedPct(s.historical)}, YTD ${s.ytd == null ? "–" : signedPct(s.ytd)})`,
          )
          .join("; ")}.`,
      );
    } else {
      const negative = trendDrivers.filter((s) => s.cagr < 0);
      const positive = trendDrivers.filter((s) => s.cagr > 0);
      if (negative.length > 0) {
        bullets.push(
          `Historisk trend trekker ned: ${negative
            .map((s) => `${s.label} ${signedPct(s.cagr)}`)
            .join(", ")}.`,
        );
      }
      if (positive.length > 0) {
        bullets.push(
          `Positiv trend i: ${positive.map((s) => `${s.label} ${signedPct(s.cagr)}`).join(", ")}.`,
        );
      }
    }
  } else if (nextYear.trendApplied) {
    bullets.push("Segment-trendene er nær null; trend forklarer lite av endringen.");
  }

  const activeDrivers = Object.entries(driverIndices)
    .map(([driver, info]) => ({
      label: TMF_DRIVER_LABELS[driver as keyof typeof TMF_DRIVER_LABELS] ?? driver,
      index: info.index,
      avgChangePct: info.avgChangePct,
    }))
    .filter((d) => Math.abs(d.index - 1) >= 0.01);

  if (activeDrivers.length > 0) {
    const dampening = activeDrivers.filter((d) => d.index < 1);
    const lifting = activeDrivers.filter((d) => d.index > 1);
    if (dampening.length > 0) {
      bullets.push(
        `SSB-indikatorer demper: ${dampening
          .map(
            (d) =>
              `${d.label} (faktor ×${d.index.toFixed(2)}${
                d.avgChangePct == null ? "" : `, YoY ${signedPct(d.avgChangePct)}`
              })`,
          )
          .join("; ")}.`,
      );
    }
    if (lifting.length > 0) {
      bullets.push(
        `SSB-indikatorer løfter: ${lifting
          .map(
            (d) =>
              `${d.label} (faktor ×${d.index.toFixed(2)}${
                d.avgChangePct == null ? "" : `, YoY ${signedPct(d.avgChangePct)}`
              })`,
          )
          .join("; ")}.`,
      );
    }
  } else {
    bullets.push("SSB-indikatorene er nær nøytrale i denne kjøringen.");
  }

  const analystAdj = nextYear.segments.filter((s) => s.analystAdjustmentPct !== 0);
  if (analystAdj.length > 0) {
    bullets.push(
      `Analytikerjustering er lagt inn: ${analystAdj
        .map((s) => `${s.label} ${signedPct(s.analystAdjustmentPct)}`)
        .join(", ")}.`,
    );
  } else {
    bullets.push("Ingen analytikerjustering er lagt inn — tallet er modell + valgt scenario.");
  }

  const segmentDeltas = nextYear.segments
    .map((nextSeg) => {
      const currentSeg = currentYear.segments.find((s) => s.pabygg === nextSeg.pabygg);
      const currentVal = currentSeg?.annualAdjustedForecast ?? 0;
      const changePct =
        currentVal > 0 ? ((nextSeg.annualMarket - currentVal) / currentVal) * 100 : 0;
      return {
        label: nextSeg.label,
        changePct,
      };
    })
    .sort((a, b) => a.changePct - b.changePct);

  const bigMoves = segmentDeltas.filter((s) => Math.abs(s.changePct) >= 5);
  if (bigMoves.length > 0) {
    bullets.push(
      `Størst endring per segment: ${bigMoves
        .map((s) => `${s.label} ${signedPct(s.changePct)}`)
        .join(", ")}.`,
    );
  }

  const caveats = [
    "Prognosen gjelder OFV-nyregistreringer (markedspotensial), ikke leveranser.",
    `Historisk treffsikkerhet (OFV-kjerne MAPE): ${formatPercent(calibration.coreMape, 1)} %. P10/P90 er beslutningsstøtte, ikke et statistisk prediksjonsintervall.`,
    "Baseline speiler siste 12 måneder. Trend blender historisk CAGR med YTD-momentum (maks 65 % vekt) for neste kalenderår.",
    "ICE/EMOB er mekanisk split av TMF-volumet med trailing 12-mnd andel (samme mønster som Volvo-andel) — ikke en egen el-prognose.",
  ];

  return { headline, lead, bullets, caveats };
}
