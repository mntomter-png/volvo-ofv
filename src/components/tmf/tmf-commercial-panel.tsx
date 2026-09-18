"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import {
  COMMERCIAL_KIND_DESCRIPTIONS,
  COMMERCIAL_KIND_LABELS,
  ORDER_PASS_THROUGH,
  QUOTE_ONLY_PASS_THROUGH,
  type TmfCommercialIndicator,
  type TmfCommercialSignal,
} from "@/lib/tmf/commercial";
import {
  deleteTmfCommercialYear,
  upsertTmfCommercialYear,
} from "@/lib/tmf/commercial-actions";

interface TmfCommercialPanelProps {
  indicators: TmfCommercialIndicator[];
  currentYear: number;
  defaultMonths: number;
  signal: TmfCommercialSignal;
}

interface YearRow {
  periodYear: number;
  monthsCovered: number;
  orderIntakeYoyPct: string;
  quoteActivityYoyPct: string;
  note: string;
  exists: boolean;
}

function rowsFromIndicators(
  indicators: TmfCommercialIndicator[],
  currentYear: number,
  defaultMonths: number,
): YearRow[] {
  const years = new Set(indicators.map((item) => item.periodYear));
  years.add(currentYear);

  return [...years]
    .sort((a, b) => b - a)
    .map((periodYear) => {
      const ofYear = indicators.filter((item) => item.periodYear === periodYear);
      const order = ofYear.find((item) => item.kind === "order_intake");
      const quote = ofYear.find((item) => item.kind === "quote_activity");
      const months =
        order?.monthsCovered ?? quote?.monthsCovered ?? (periodYear === currentYear ? defaultMonths : 12);
      return {
        periodYear,
        monthsCovered: months,
        orderIntakeYoyPct: order ? String(order.yoyPct) : "",
        quoteActivityYoyPct: quote ? String(quote.yoyPct) : "",
        note: order?.note ?? quote?.note ?? "",
        exists: ofYear.length > 0,
      };
    });
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, 1)} %`;
}

export function TmfCommercialPanel({
  indicators,
  currentYear,
  defaultMonths,
  signal,
}: TmfCommercialPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initial = useMemo(
    () => rowsFromIndicators(indicators, currentYear, defaultMonths),
    [indicators, currentYear, defaultMonths],
  );
  const [rows, setRows] = useState<YearRow[]>(initial);

  function updateRow(year: number, patch: Partial<YearRow>) {
    setRows((current) =>
      current.map((row) => (row.periodYear === year ? { ...row, ...patch } : row)),
    );
  }

  function saveRow(row: YearRow) {
    startTransition(async () => {
      const result = await upsertTmfCommercialYear({
        periodYear: row.periodYear,
        monthsCovered: row.monthsCovered,
        orderIntakeYoyPct: row.orderIntakeYoyPct,
        quoteActivityYoyPct: row.quoteActivityYoyPct,
        note: row.note,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lagret indikatorer for ${row.periodYear}`);
      router.refresh();
    });
  }

  function removeYear(year: number) {
    startTransition(async () => {
      const result = await deleteTmfCommercialYear(year);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Slettet ${year}`);
      setRows((current) => current.filter((row) => row.periodYear !== year));
      router.refresh();
    });
  }

  function addPreviousYear() {
    const oldest = Math.min(...rows.map((row) => row.periodYear));
    const next = oldest - 1;
    if (rows.some((row) => row.periodYear === next)) return;
    setRows((current) => [
      ...current,
      {
        periodYear: next,
        monthsCovered: 12,
        orderIntakeYoyPct: "",
        quoteActivityYoyPct: "",
        note: "",
        exists: false,
      },
    ]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ordreinngang og tilbudsaktivitet</CardTitle>
        <CardDescription>
          Prosentvis endring mot samme periode året før, beregnet lokalt i Volvos
          systemer. Bare prosenttallet føres inn her — ingen volum eller kundedata.
          Signalet løfter eller senker Volvo-volumet for neste år, ikke totalmarkedet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">
          {COMMERCIAL_KIND_LABELS.order_intake}: {COMMERCIAL_KIND_DESCRIPTIONS.order_intake}{" "}
          Gjennomslag {Math.round(ORDER_PASS_THROUGH * 100)} %.{" "}
          {COMMERCIAL_KIND_LABELS.quote_activity}: {COMMERCIAL_KIND_DESCRIPTIONS.quote_activity}{" "}
          Alene {Math.round(QUOTE_ONLY_PASS_THROUGH * 100)} % gjennomslag; sammen med ordre
          blandes den inn, den adderes ikke.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-3 font-medium">År</th>
                <th className="pb-3 pr-3 font-medium">Mnd</th>
                <th className="pb-3 pr-3 font-medium">Ordreinngang YoY %</th>
                <th className="pb-3 pr-3 font-medium">Tilbudsaktivitet YoY %</th>
                <th className="pb-3 pr-3 font-medium">Notat</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.periodYear} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium tabular-nums">{row.periodYear}</td>
                  <td className="py-2 pr-3">
                    <Label className="sr-only" htmlFor={`tmf-mnd-${row.periodYear}`}>
                      Måneder {row.periodYear}
                    </Label>
                    <Input
                      id={`tmf-mnd-${row.periodYear}`}
                      type="number"
                      min={1}
                      max={12}
                      className="h-9 w-16"
                      disabled={isPending}
                      value={row.monthsCovered}
                      onChange={(event) =>
                        updateRow(row.periodYear, {
                          monthsCovered: Number.parseInt(event.target.value, 10) || 1,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Label className="sr-only" htmlFor={`tmf-order-${row.periodYear}`}>
                      Ordreinngang YoY {row.periodYear}
                    </Label>
                    <Input
                      id={`tmf-order-${row.periodYear}`}
                      type="number"
                      step={0.1}
                      min={-100}
                      max={200}
                      className="h-9 w-28"
                      disabled={isPending}
                      placeholder="—"
                      value={row.orderIntakeYoyPct}
                      onChange={(event) =>
                        updateRow(row.periodYear, {
                          orderIntakeYoyPct: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Label className="sr-only" htmlFor={`tmf-quote-${row.periodYear}`}>
                      Tilbudsaktivitet YoY {row.periodYear}
                    </Label>
                    <Input
                      id={`tmf-quote-${row.periodYear}`}
                      type="number"
                      step={0.1}
                      min={-100}
                      max={200}
                      className="h-9 w-28"
                      disabled={isPending}
                      placeholder="—"
                      value={row.quoteActivityYoyPct}
                      onChange={(event) =>
                        updateRow(row.periodYear, {
                          quoteActivityYoyPct: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      className="h-9 min-w-[140px]"
                      disabled={isPending}
                      placeholder="Valgfritt"
                      value={row.note}
                      onChange={(event) =>
                        updateRow(row.periodYear, { note: event.target.value })
                      }
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => saveRow(row)}
                      >
                        {isPending ? <Loader2 className="animate-spin" /> : null}
                        Lagre
                      </Button>
                      {row.exists ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => {
                            if (confirm(`Slette indikatorene for ${row.periodYear}?`)) {
                              removeYear(row.periodYear);
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={addPreviousYear}
        >
          <Plus />
          Legg til tidligere år
        </Button>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {signal.contributions.length === 0 ? (
            <p className="text-muted-foreground">
              Ingen kommersielt signal er lagt inn. Volvo-estimatet bruker da bare OFV-andel.
            </p>
          ) : (
            <div className="space-y-1">
              <p>
                Effekt på Volvo {currentYear + 1}:{" "}
                <span className="font-medium tabular-nums">{signedPct(signal.effectPct)}</span>
                {signal.clamped ? " (begrenset til ±15 %)" : null}
              </p>
              <p className="text-muted-foreground text-xs">
                {signal.contributions
                  .map(
                    (item) =>
                      `${item.label} ${item.periodYear} (${item.monthsCovered} mnd) ${signedPct(item.yoyPct)}`,
                  )
                  .join(" · ")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
