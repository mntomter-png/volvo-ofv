"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Loader2,
  Minimize2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/format";
import { getMakeColor } from "@/lib/presentation/make-colors";
import type { PresentationDeckData } from "@/lib/presentation/queries";
import { cn } from "@/lib/utils";

/** Farger for kategorier som ikke er merker (drivstoff, etc.). */
const CATEGORY_COLORS = [
  "#003087",
  "#CA8A04",
  "#0f766e",
  "#64748b",
  "#b45309",
  "#9f1239",
  "#4338ca",
  "#0284C7",
];

function SlideShell({
  children,
  title,
  eyebrow,
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-border bg-card p-6 shadow-sm lg:min-h-[34rem] lg:p-8">
      {eyebrow ? (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mb-4 max-w-4xl text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {title}
        </h2>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function InsightList({ bullets }: { bullets: string[] }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {bullets.map((bullet) => (
        <li key={bullet} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-volvo-blue" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

function makeChartData(
  rows: { name: string; count: number }[],
  limit = 6,
) {
  return rows.slice(0, limit).map((row) => ({
    name: row.name,
    count: row.count,
  }));
}

export function PresentationDeck({ data }: { data: PresentationDeckData }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const totalSlides = 8;
  const narrative =
    data.narratives[index] ??
    data.narratives[0] ?? {
      id: "fallback",
      title: "Presentasjon",
      bullets: [] as string[],
    };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setIndex((value) => Math.min(totalSlides - 1, value + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function exportExcel() {
    setExportingXlsx(true);
    try {
      const res = await fetch("/api/export/presentation");
      if (!res.ok) throw new Error(`Eksport feilet (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
        "presentasjon.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel lastet ned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eksport feilet");
    } finally {
      setExportingXlsx(false);
    }
  }

  async function exportPptx() {
    setExportingPptx(true);
    try {
      const res = await fetch("/api/export/presentation-pptx");
      if (!res.ok) throw new Error(`Eksport feilet (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
        "presentasjon.pptx";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PowerPoint lastet ned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "PowerPoint-eksport feilet",
      );
    } finally {
      setExportingPptx(false);
    }
  }

  const ytdMake = data.makeSharePeriods.find((period) =>
    period.label.startsWith("YTD"),
  );
  const make2019 = data.makeSharePeriods.find((period) => period.year === 2019);
  const focusYtdShare =
    ytdMake && ytdMake.total > 0
      ? (ytdMake.rows.find((row) => row.name === data.focusMake)?.count ?? 0) /
        ytdMake.total
      : 0;

  return (
    <div
      className={cn(
        "space-y-4",
        fullscreen &&
          "fixed inset-0 z-50 overflow-auto bg-background p-4 lg:p-8",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Slide {index + 1} / {totalSlides} · {data.periodLabel}
          <span className="mx-2 text-border">·</span>
          {data.meta.narrativeOrigin}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={exportingXlsx}
          >
            {exportingXlsx ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPptx}
            disabled={exportingPptx}
          >
            {exportingPptx ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            PowerPoint
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <Minimize2 /> : <Expand />}
            {fullscreen ? "Avslutt" : "Fullskjerm"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setIndex((value) => Math.min(totalSlides - 1, value + 1))
            }
            disabled={index === totalSlides - 1}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {data.error ? (
        <p className="text-sm text-destructive">
          Noen tall kunne ikke hentes: {data.error}
        </p>
      ) : null}

      {index === 0 ? (
        <SlideShell>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-volvo-blue">
              Volvo Trucks
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight lg:text-6xl">
              {data.meta.title}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {data.meta.subtitle}
            </p>
            <p className="mt-8 text-sm text-muted-foreground">
              {data.meta.sourceNote}
            </p>
          </div>
        </SlideShell>
      ) : null}

      {index === 1 ? (
        <SlideShell title={narrative.title} eyebrow="Markedsvolum">
          <div className="grid flex-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.volumeByYear}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatNumber(value)}
                    labelFormatter={(year) => `År ${year}`}
                  />
                  <Bar dataKey="count" name="Enheter" fill="#003087" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="rounded-xl bg-muted/50 p-4 text-sm">
                <p className="font-medium text-foreground">Live status</p>
                <p className="mt-1 text-muted-foreground">
                  {data.currentYear}
                  {data.volumeByYear.find((row) => row.year === data.currentYear)
                    ?.partial
                    ? " (YTD)"
                    : ""}
                  :{" "}
                  {formatNumber(
                    data.volumeByYear.find((row) => row.year === data.currentYear)
                      ?.count ?? 0,
                  )}{" "}
                  enheter
                </p>
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      {index === 2 ? (
        <SlideShell title={narrative.title} eyebrow="Markedsandel">
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="min-h-[16rem]">
              <p className="mb-2 text-sm font-medium">
                {ytdMake?.label ?? "YTD"} (live)
              </p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={makeChartData(ytdMake?.rows ?? [])}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="count" radius={4}>
                    {(ytdMake?.rows ?? []).slice(0, 6).map((row) => (
                      <Cell key={row.name} fill={getMakeColor(row.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/50 p-4 text-sm">
                  <p className="text-muted-foreground">{data.focusMake} YTD</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatPercent(focusYtdShare * 100, 1)} %
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-sm">
                  <p className="text-muted-foreground">
                    {data.focusMake} 2019
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatPercent(
                      make2019 && make2019.total > 0
                        ? ((make2019.rows.find((row) => row.name === data.focusMake)
                            ?.count ?? 0) /
                            make2019.total) *
                            100
                        : 0,
                      1,
                    )}{" "}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      {index === 3 ? (
        <SlideShell title={narrative.title} eyebrow="Segmenter">
          <div className="grid flex-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.segmentShares.map((row) => ({
                    name: row.label,
                    share: Math.round(row.focusShare * 1000) / 10,
                    competitor: Math.round(row.topCompetitorShare * 1000) / 10,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="share"
                    name={`${data.focusMake} %`}
                    fill="#003087"
                    radius={4}
                  />
                  <Bar
                    dataKey="competitor"
                    name="Største konkurrent %"
                    fill="#94a3b8"
                    radius={4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="space-y-2 text-sm">
                {data.segmentShares.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                  >
                    <span className="font-medium">{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatPercent(row.focusShare * 100, 0)} % ·{" "}
                      {formatNumber(row.total)} enh.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      {index === 4 ? (
        <SlideShell title={narrative.title} eyebrow="Drivlinje">
          <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.fuelMix}
                    dataKey="count"
                    nameKey="fuel"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {data.fuelMix.map((row, i) => (
                      <Cell
                        key={row.fuel}
                        fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Fossilfri andel (el + gass)
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatPercent(data.fossilFreeShare * 100, 1)} %
                </p>
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      {index === 5 ? (
        <SlideShell title={narrative.title} eyebrow="El per segment">
          <div className="grid flex-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.electricByBodywork.map((row) => ({
                    name: row.label,
                    share: Math.round(row.electricShare * 1000) / 10,
                    electric: row.electricCount,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Bar dataKey="share" name="El-andel %" fill="#0f766e" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <InsightList bullets={narrative.bullets} />
          </div>
        </SlideShell>
      ) : null}

      {index === 6 ? (
        <SlideShell title={narrative.title} eyebrow="Gass">
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="min-h-[16rem]">
              <p className="mb-2 text-sm font-medium">Gassandel per segment</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart
                  data={data.gasByBodywork.map((row) => ({
                    name: row.label,
                    share: Math.round(row.gasShare * 1000) / 10,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Bar dataKey="share" fill="#b45309" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="min-h-[12rem]">
                <p className="mb-2 text-sm font-medium">Gass – merkeandel YTD</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={makeChartData(data.gasMakeShare.rows, 5)}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="count" radius={4}>
                      {data.gasMakeShare.rows.slice(0, 5).map((row) => (
                        <Cell key={row.name} fill={getMakeColor(row.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      {index === 7 ? (
        <SlideShell title={narrative.title} eyebrow="BEV-konkurranse">
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="min-h-[14rem]">
              <p className="mb-2 text-sm font-medium">El-volum per år</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data.electricByYear}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="count" fill="#0f766e" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <InsightList bullets={narrative.bullets} />
              <div className="min-h-[12rem]">
                <p className="mb-2 text-sm font-medium">El – merkeandel YTD</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={makeChartData(data.electricMakeShare.rows, 6)}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="count" radius={4}>
                      {data.electricMakeShare.rows.slice(0, 6).map((row) => (
                        <Cell key={row.name} fill={getMakeColor(row.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </SlideShell>
      ) : null}

      <div className="flex justify-center gap-2">
        {Array.from({ length: totalSlides }).map((_, slideIndex) => (
          <button
            key={slideIndex}
            type="button"
            aria-label={`Gå til slide ${slideIndex + 1}`}
            onClick={() => setIndex(slideIndex)}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              slideIndex === index ? "bg-volvo-blue" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
