import type PptxGenJS from "pptxgenjs";

import type { PresentationDeckData } from "@/lib/presentation/queries";
import { formatNumber, formatPercent } from "@/lib/format";
import { getMakeColor } from "@/lib/presentation/make-colors";
import type { SlideNarrative } from "@/lib/presentation/narrative";

function hexForPptx(hex: string): string {
  return hex.replace(/^#/, "");
}

function makeChartColors(names: string[]): string[] {
  return names.map((name) => hexForPptx(getMakeColor(name)));
}

function narrativeAt(
  data: PresentationDeckData,
  index: number,
): SlideNarrative {
  const slide = data.narratives[index] ?? data.narratives[0];
  if (!slide) {
    return { id: "fallback", title: "Presentasjon", bullets: [] };
  }
  return slide;
}

/** Bygger PPTX-buffer på serveren. */
export async function buildPresentationPptxBuffer(
  data: PresentationDeckData,
): Promise<{ buffer: Buffer; filename: string }> {
  const PptxGenJSCtor = (await import("pptxgenjs")).default;
  const pptx: PptxGenJS = new PptxGenJSCtor();
  pptx.author = "Volvo OFV";
  pptx.title = `${data.meta.title} – ${data.currentYear}`;

  const title = pptx.addSlide();
  title.addText(data.meta.title, {
    x: 0.8,
    y: 2.2,
    w: 8.4,
    fontSize: 40,
    bold: true,
    color: "003087",
  });
  title.addText(data.meta.subtitle, {
    x: 0.8,
    y: 3.1,
    w: 8.4,
    fontSize: 18,
    color: "475569",
  });
  title.addText(`${data.meta.sourceNote} · ${data.periodLabel}`, {
    x: 0.8,
    y: 4.8,
    w: 8.4,
    fontSize: 12,
    color: "64748b",
  });

  const n1 = narrativeAt(data, 1);
  const volume = pptx.addSlide();
  volume.addText(n1.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 24,
    bold: true,
    color: "003087",
  });
  volume.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Enheter",
        labels: data.volumeByYear.map((row) => String(row.year)),
        values: data.volumeByYear.map((row) => row.count),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  volume.addText(
    n1.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, h: 3.5, fontSize: 12, color: "334155" },
  );

  const n2 = narrativeAt(data, 2);
  const ytd = data.makeSharePeriods.find((p) => p.label.startsWith("YTD"));
  const share = pptx.addSlide();
  share.addText(n2.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  const shareLabels = (ytd?.rows ?? []).slice(0, 6).map((row) => row.name);
  share.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Enheter",
        labels: shareLabels,
        values: (ytd?.rows ?? []).slice(0, 6).map((row) => row.count),
      },
    ],
    {
      x: 0.5,
      y: 1.0,
      w: 5.5,
      h: 4.0,
      chartColors: makeChartColors(shareLabels),
    },
  );
  share.addText(
    n2.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n3 = narrativeAt(data, 3);
  const segments = pptx.addSlide();
  segments.addText(n3.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  segments.addChart(
    pptx.ChartType.bar,
    [
      {
        name: `${data.focusMake} %`,
        labels: data.segmentShares.map((row) => row.label),
        values: data.segmentShares.map(
          (row) => Math.round(row.focusShare * 1000) / 10,
        ),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  segments.addText(
    data.segmentShares.map((row) => ({
      text: `${row.label}: ${formatPercent(row.focusShare * 100, 0)} % (${formatNumber(row.total)})`,
      options: { bullet: true },
    })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n4 = narrativeAt(data, 4);
  const fuel = pptx.addSlide();
  fuel.addText(n4.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  fuel.addChart(
    pptx.ChartType.pie,
    [
      {
        name: "Drivlinje",
        labels: data.fuelMix.map((row) => row.fuel),
        values: data.fuelMix.map((row) => row.count),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.0, h: 4.0 },
  );
  fuel.addText(
    [
      {
        text: `Fossilfri andel: ${formatPercent(data.fossilFreeShare * 100, 1)} %`,
        options: { bullet: false, bold: true },
      },
      ...n4.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    ],
    { x: 5.8, y: 1.4, w: 3.7, fontSize: 13, color: "334155" },
  );

  const n5 = narrativeAt(data, 5);
  const bevSeg = pptx.addSlide();
  bevSeg.addText(n5.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  bevSeg.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "El-andel %",
        labels: data.electricByBodywork.map((row) => row.label),
        values: data.electricByBodywork.map(
          (row) => Math.round(row.electricShare * 1000) / 10,
        ),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  bevSeg.addText(
    n5.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n6 = narrativeAt(data, 6);
  const gas = pptx.addSlide();
  gas.addText(n6.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  gas.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Gassandel %",
        labels: data.gasByBodywork.map((row) => row.label),
        values: data.gasByBodywork.map(
          (row) => Math.round(row.gasShare * 1000) / 10,
        ),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  gas.addText(
    n6.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n7 = narrativeAt(data, 7);
  const bevComp = pptx.addSlide();
  bevComp.addText(n7.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  bevComp.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "El-volum",
        labels: data.electricByYear.map((row) => String(row.year)),
        values: data.electricByYear.map((row) => row.count),
      },
    ],
    { x: 0.5, y: 1.0, w: 4.5, h: 3.8 },
  );
  const elMakeLabels = data.electricMakeShare.rows
    .slice(0, 5)
    .map((row) => row.name);
  bevComp.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "El merker",
        labels: elMakeLabels,
        values: data.electricMakeShare.rows.slice(0, 5).map((row) => row.count),
      },
    ],
    {
      x: 5.2,
      y: 1.0,
      w: 4.3,
      h: 2.4,
      chartColors: makeChartColors(elMakeLabels),
    },
  );
  bevComp.addText(
    n7.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 5.2, y: 3.6, w: 4.3, fontSize: 11, color: "334155" },
  );

  const filename = `presentasjon-${data.currentYear}-${data.ytdTo}.pptx`;
  const output = await pptx.write({ outputType: "nodebuffer" });
  return { buffer: Buffer.from(output as ArrayBuffer), filename };
}
