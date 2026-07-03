"use client";

import { useState, useTransition } from "react";
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
    if (!budget) return;
    const params = buildTmfPageSearchParams(budget.config);
    startTransition(() => {
      router.push(`/tmf?${params.toString()}`);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTmfBudgetVersion(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Budsjettversjon slettet");
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

      toast.success("Budsjettversjon lagret");
      setSaveOpen(false);
    });
  }

  const exportUrl = `/api/export/tmf?${buildTmfPageSearchParams(currentConfig).toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        disabled={isPending || budgets.length === 0}
        onValueChange={(value) => {
          if (value === NONE_VALUE) return;
          loadBudget(value);
        }}
      >
        <SelectTrigger className="w-[260px]">
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
          <Button variant="outline" size="sm">
            <BookmarkPlus />
            Lagre budsjett
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={onSaveSubmit}>
            <DialogHeader>
              <DialogTitle>Lagre budsjettversjon</DialogTitle>
              <DialogDescription>
                Lagrer scenario, analytikerjusteringer og Volvo-overstyringer for{" "}
                {nextYear}.
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
                  placeholder={`TMF ${nextYear} – basis`}
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
                Lagre
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
          disabled={isPending}
          onValueChange={(value) => {
            if (value === NONE_VALUE) return;
            if (confirm("Slette denne budsjettversjonen?")) {
              handleDelete(value);
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
  );
}
