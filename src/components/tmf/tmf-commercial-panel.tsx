"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
  buildCommercialSignal,
  COMMERCIAL_KIND_DESCRIPTIONS,
  COMMERCIAL_KIND_LABELS,
  ORDER_PASS_THROUGH,
  parseYoyPctInput,
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

function rowPayload(row: YearRow) {
  return {
    periodYear: row.periodYear,
    monthsCovered: row.monthsCovered,
    orderIntakeYoyPct: parseYoyPctInput(row.orderIntakeYoyPct),
    quoteActivityYoyPct: parseYoyPctInput(row.quoteActivityYoyPct),
    note: row.note.trim(),
  };
}

function payloadKey(row: YearRow): string {
  const payload = rowPayload(row);
  return [
    payload.periodYear,
    payload.monthsCovered,
    payload.orderIntakeYoyPct ?? "",
    payload.quoteActivityYoyPct ?? "",
    payload.note,
  ].join("|");
}

function draftIndicators(rows: YearRow[]): TmfCommercialIndicator[] {
  const out: TmfCommercialIndicator[] = [];
  for (const row of rows) {
    const order = parseYoyPctInput(row.orderIntakeYoyPct);
    const quote = parseYoyPctInput(row.quoteActivityYoyPct);
    if (order != null) {
      out.push({
        id: `draft-order-${row.periodYear}`,
        kind: "order_intake",
        periodYear: row.periodYear,
        monthsCovered: row.monthsCovered,
        yoyPct: order,
        note: row.note || null,
        updatedAt: "",
      });
    }
    if (quote != null) {
      out.push({
        id: `draft-quote-${row.periodYear}`,
        kind: "quote_activity",
        periodYear: row.periodYear,
        monthsCovered: row.monthsCovered,
        yoyPct: quote,
        note: row.note || null,
        updatedAt: "",
      });
    }
  }
  return out;
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
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const savedKeys = useRef(new Map(initial.map((row) => [row.periodYear, payloadKey(row)])));

  const draftSignal = useMemo(
    () => buildCommercialSignal(draftIndicators(rows), currentYear),
    [rows, currentYear],
  );
  const preview = draftSignal.contributions.length > 0 ? draftSignal : signal;

  function updateRow(year: number, patch: Partial<YearRow>) {
    setRows((current) => {
      const next = current.map((row) =>
        row.periodYear === year ? { ...row, ...patch } : row,
      );
      rowsRef.current = next;
      return next;
    });
  }

  function saveYear(year: number) {
    const row = rowsRef.current.find((item) => item.periodYear === year);
    if (!row) return;

    const key = payloadKey(row);
    if (savedKeys.current.get(year) === key) return;

    const order = parseYoyPctInput(row.orderIntakeYoyPct);
    const quote = parseYoyPctInput(row.quoteActivityYoyPct);
    if (order == null && quote == null && !row.exists) return;

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
      savedKeys.current.set(year, key);
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
      savedKeys.current.delete(year);
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

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.periodYear}
              className="space-y-3 rounded-md border border-border/70 p-3"
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                saveYear(row.periodYear);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium tabular-nums">{row.periodYear}</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => saveYear(row.periodYear)}
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
                      aria-label={`Slett ${row.periodYear}`}
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
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`tmf-mnd-${row.periodYear}`}>Mnd</Label>
                  <Input
                    id={`tmf-mnd-${row.periodYear}`}
                    type="number"
                    min={1}
                    max={12}
                    className="h-9"
                    disabled={isPending}
                    value={row.monthsCovered}
                    onChange={(event) =>
                      updateRow(row.periodYear, {
                        monthsCovered: Number.parseInt(event.target.value, 10) || 1,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`tmf-order-${row.periodYear}`}>
                    Ordreinngang YoY %
                  </Label>
                  <Input
                    id={`tmf-order-${row.periodYear}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-9"
                    disabled={isPending}
                    placeholder="−8,5"
                    value={row.orderIntakeYoyPct}
                    onChange={(event) =>
                      updateRow(row.periodYear, {
                        orderIntakeYoyPct: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor={`tmf-quote-${row.periodYear}`}>
                    Tilbudsaktivitet YoY %
                  </Label>
                  <Input
                    id={`tmf-quote-${row.periodYear}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-9"
                    disabled={isPending}
                    placeholder="—"
                    value={row.quoteActivityYoyPct}
                    onChange={(event) =>
                      updateRow(row.periodYear, {
                        quoteActivityYoyPct: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`tmf-note-${row.periodYear}`} className="sr-only">
                  Notat {row.periodYear}
                </Label>
                <Input
                  id={`tmf-note-${row.periodYear}`}
                  className="h-9"
                  disabled={isPending}
                  placeholder="Notat (valgfritt)"
                  value={row.note}
                  onChange={(event) =>
                    updateRow(row.periodYear, { note: event.target.value })
                  }
                />
              </div>
            </div>
          ))}
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
          {preview.contributions.length === 0 ? (
            <p className="text-muted-foreground">
              Ingen kommersielt signal er lagt inn. Volvo-estimatet bruker da bare OFV-andel.
            </p>
          ) : (
            <div className="space-y-1">
              <p>
                Effekt på Volvo {currentYear + 1}:{" "}
                <span className="font-medium tabular-nums">{signedPct(preview.effectPct)}</span>
                {preview.clamped ? " (begrenset til ±15 %)" : null}
              </p>
              <p className="text-muted-foreground text-xs">
                {preview.contributions
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
