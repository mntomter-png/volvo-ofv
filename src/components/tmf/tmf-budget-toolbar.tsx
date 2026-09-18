"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { BookmarkPlus, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildTmfPageSearchParams,
  describeTmfBudgetConfig,
  normalizeTmfBudgetConfig,
  parseTmfJsonParam,
} from "@/lib/tmf/adjustments";
import { createTmfBudgetVersion, deleteTmfBudgetVersion } from "@/lib/tmf/budget-actions";
import type { TmfBudgetVersionRow } from "@/lib/tmf/budget-queries";
import { isTmfScenarioId } from "@/lib/tmf/scenarios";

const NONE_VALUE = "__none__";

interface TmfBudgetToolbarProps {
  budgets: TmfBudgetVersionRow[];
  nextYear: number;
}

export function TmfBudgetToolbar({ budgets, nextYear }: TmfBudgetToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveOpen, setSaveOpen] = useState(false);
  /** Styrt verdi så samme versjon kan velges på nytt etter navigasjon. */
  const [loadSelectValue, setLoadSelectValue] = useState(NONE_VALUE);
  const [deleteSelectValue, setDeleteSelectValue] = useState(NONE_VALUE);

  const [scenario] = useQueryState("scenario", { defaultValue: "basis" });
  const [adjRaw] = useQueryState("adj", { defaultValue: "" });
  const [volvoRaw] = useQueryState("volvo", { defaultValue: "" });

  const currentConfig = normalizeTmfBudgetConfig({
    scenario: isTmfScenarioId(scenario ?? "basis") ? scenario : "basis",
    segmentAdjustments: parseTmfJsonParam(adjRaw ?? undefined),
    volvoShareOverrides: parseTmfJsonParam(volvoRaw ?? undefined),
  });

  function loadBudget(budgetId: string) {
    const budget = budgets.find((item) => item.id === budgetId);
    if (!budget) {
      setLoadSelectValue(NONE_VALUE);
      return;
    }

    const params = buildTmfPageSearchParams(budget.config);
    const href = `/tmf?${params.toString()}` as Route;

    startTransition(() => {
      router.push(href);
      router.refresh();
      toast.success(`Lastet «${budget.name}»`, {
        description: `${describeTmfBudgetConfig(budget.config)}. Viser oppdaterte tall — sammenlign med de fryste under Versjonssporing.`,
      });
      setLoadSelectValue(NONE_VALUE);
    });
  }

  function handleDelete(id: string) {
    const budget = budgets.find((item) => item.id === id);
    startTransition(async () => {
      const result = await deleteTmfBudgetVersion(id);
      setDeleteSelectValue(NONE_VALUE);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(budget ? `Slettet «${budget.name}»` : "Budsjettversjon slettet");
      router.refresh();
    });
  }

  function onSaveSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createTmfBudgetVersion({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || null,
        targetYear: nextYear,
        config: currentConfig,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Ny budsjettversjon lagret");
      setSaveOpen(false);
      router.refresh();
    });
  }

  const exportUrl = `/api/export/tmf?${buildTmfPageSearchParams(currentConfig).toString()}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={loadSelectValue}
          disabled={isPending || budgets.length === 0}
          onValueChange={(value) => {
            if (value === NONE_VALUE) return;
            setLoadSelectValue(value);
            loadBudget(value);
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Last budsjettversjon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} disabled>
              Velg versjon
            </SelectItem>
            {budgets.map((budget) => (
              <SelectItem key={budget.id} value={budget.id}>
                {budget.name} ({budget.target_year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <BookmarkPlus />
              Lagre ny versjon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onSaveSubmit}>
              <DialogHeader>
                <DialogTitle>Lagre ny budsjettversjon</DialogTitle>
                <DialogDescription>
                  Oppretter en ny versjon med dagens scenario, analytikerjusteringer og
                  Volvo-overstyringer for {nextYear}, og fryser tallene som gjelder nå.
                  Eksisterende versjoner endres ikke.
                </DialogDescription>
              </DialogHeader>

              <div className="my-4 space-y-4">
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Innhold: </span>
                  <span className="font-medium">
                    {describeTmfBudgetConfig(currentConfig)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tmf-budget-name">Navn</Label>
                  <Input
                    id="tmf-budget-name"
                    name="name"
                    required
                    placeholder={`TMF ${nextYear} – ${currentConfig.scenario}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tmf-budget-description">Beskrivelse (valgfritt)</Label>
                  <Textarea
                    id="tmf-budget-description"
                    name="description"
                    rows={3}
                    placeholder="Notater om forutsetninger, møter eller beslutninger"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : null}
                  Lagre ny versjon
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" asChild>
          <a href={exportUrl}>
            <Download />
            Eksporter Excel
          </a>
        </Button>

        {budgets.length > 0 && (
          <Select
            value={deleteSelectValue}
            disabled={isPending}
            onValueChange={(value) => {
              if (value === NONE_VALUE) return;
              setDeleteSelectValue(value);
              if (confirm("Slette denne budsjettversjonen?")) {
                handleDelete(value);
              } else {
                setDeleteSelectValue(NONE_VALUE);
              }
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Slett versjon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE} disabled>
                Slett versjon
              </SelectItem>
              {budgets.map((budget) => (
                <SelectItem key={budget.id} value={budget.id}>
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="size-3.5" />
                    {budget.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Versjoner fryser tallene slik de er ved lagring, i tillegg til scenario og
        justeringer. Å laste en versjon setter forutsetningene og viser oppdaterte tall —
        de fryste tallene ligger under Versjonssporing.
      </p>
    </div>
  );
}
