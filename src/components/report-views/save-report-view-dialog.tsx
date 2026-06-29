"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createReportView } from "@/lib/report-views/actions";
import type { PageType, ReportViewConfig } from "@/lib/supabase/types";

interface SaveReportViewDialogProps {
  pageType: PageType;
  config: ReportViewConfig;
  filterSummary: string;
  description?: string;
}

export function SaveReportViewDialog({
  pageType,
  config,
  filterSummary,
  description = "Lagrer gjeldende filter slik at du kan hente det fram igjen senere.",
}: SaveReportViewDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createReportView({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || null,
        page_type: pageType,
        config,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Rapportvisning lagret");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus />
          Lagre visning
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Lagre rapportvisning</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter: </span>
              <span className="font-medium">{filterSummary}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-view-name">Navn</Label>
              <Input
                id="report-view-name"
                name="name"
                placeholder="F.eks. Volvo – Distribution 2026"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-view-description">Beskrivelse (valgfritt)</Label>
              <Textarea
                id="report-view-description"
                name="description"
                placeholder="Kort notat om hva denne visningen brukes til"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Lagrer…
                </>
              ) : (
                "Lagre"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
