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

function narrativeById(
  data: PresentationDeckData,
  id: string,
): SlideNarrative {
  const slide = data.narratives.find((item) => item.id === id);
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

  const n1 = narrativeById(data, "market-volume");
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
    data.tmfAnnualForecast != null
      ? [
          {
            name: "YTD / faktisk",
            labels: data.volumeByYear.map((row) => String(row.year)),
            values: data.volumeByYear.map((row) => row.count),
          },
          {
            name: "TMF prognose",
            labels: data.volumeByYear.map((row) => String(row.year)),
            values: data.volumeByYear.map((row) =>
              row.forecastCount != null ? row.forecastCount : 0,
            ),
          },
        ]
      : [
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

  const n2 = narrativeById(data, "make-share");
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

  const nFlow = narrativeById(data, "flow-vs-stock");
  const flow = pptx.addSlide();
  flow.addText(nFlow.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  flow.addChart(
    pptx.ChartType.bar,
    [
      {
        name: `${data.focusMake} %`,
        labels: ["Nyregistrering", "Park"],
        values: [
          Math.round(data.flowStock.flowShare * 1000) / 10,
          Math.round(data.flowStock.stockShare * 1000) / 10,
        ],
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  flow.addText(
    nFlow.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const nRegions = narrativeById(data, "regions");
  const regions = pptx.addSlide();
  regions.addText(nRegions.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  regions.addChart(
    pptx.ChartType.bar,
    [
      {
        name: `${data.focusMake} %`,
        labels: data.regionShares.map((row) => `R${row.region}`),
        values: data.regionShares.map(
          (row) => Math.round(row.focusShare * 1000) / 10,
        ),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  regions.addText(
    nRegions.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n3 = narrativeById(data, "segments");
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

  const nHp = narrativeById(data, "hp-mix");
  const hp = pptx.addSlide();
  hp.addText(nHp.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  hp.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Volum",
        labels: data.hpShares.map((row) => row.label),
        values: data.hpShares.map((row) => row.count),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  hp.addText(
    nHp.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const nLoyalty = narrativeById(data, "loyalty");
  const loyalty = pptx.addSlide();
  loyalty.addText(nLoyalty.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  loyalty.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Eiere",
        labels: ["Gjentak", "Nye", "Conquest"],
        values: [
          data.loyalty.repeat.owners,
          data.loyalty.new.owners,
          data.loyalty.conquest.owners,
        ],
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  loyalty.addText(
    nLoyalty.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const n4 = narrativeById(data, "driveline");
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

  const n5 = narrativeById(data, "bev-segments");
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

  const n6 = narrativeById(data, "gas");
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

  const n7 = narrativeById(data, "bev-competition");
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

  const nNext = narrativeById(data, "tmf-next-year");
  if (data.tmfNextYear) {
    const next = pptx.addSlide();
    next.addText(nNext.title, {
      x: 0.5,
      y: 0.3,
      w: 9,
      fontSize: 22,
      bold: true,
      color: "003087",
    });
    next.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Enheter",
          labels: ["Marked", data.focusMake, "Elektrisk"],
          values: [
            data.tmfNextYear.annualMarket,
            data.tmfNextYear.annualVolvo,
            data.tmfNextYear.annualEmob,
          ],
        },
      ],
      { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
    );
    next.addText(
      nNext.bullets.map((b) => ({ text: b, options: { bullet: true } })),
      { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
    );
  }

  const nSegF = narrativeById(data, "tmf-segments");
  const segF = pptx.addSlide();
  segF.addText(nSegF.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 22,
    bold: true,
    color: "003087",
  });
  segF.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Marked",
        labels: data.tmfSegmentForecast.map((row) => row.label),
        values: data.tmfSegmentForecast.map((row) => row.annualMarket),
      },
    ],
    { x: 0.5, y: 1.0, w: 5.5, h: 4.0 },
  );
  segF.addText(
    nSegF.bullets.map((b) => ({ text: b, options: { bullet: true } })),
    { x: 6.2, y: 1.2, w: 3.3, fontSize: 12, color: "334155" },
  );

  const filename = `presentasjon-${data.currentYear}-${data.ytdTo}.pptx`;
  const output = await pptx.write({ outputType: "nodebuffer" });
  return { buffer: Buffer.from(output as ArrayBuffer), filename };
}
