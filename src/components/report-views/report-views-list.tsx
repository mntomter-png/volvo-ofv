"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { deleteReportView, updateReportView } from "@/lib/report-views/actions";
import {
  buildPageUrl,
  describeReportViewConfig,
  PAGE_TYPE_LABELS,
} from "@/lib/report-views/config";
import type { ReportViewRow } from "@/lib/report-views/queries";

interface ReportViewsListProps {
  views: ReportViewRow[];
}

export function ReportViewsList({ views }: ReportViewsListProps) {
  const [editingView, setEditingView] = useState<ReportViewRow | null>(null);
  const [deletingView, setDeletingView] = useState<ReportViewRow | null>(null);
  const [isPending, startTransition] = useTransition();

  if (views.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm font-medium">Ingen lagrede visninger ennå</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gå til{" "}
          <Link href="/" className="text-volvo-blue underline-offset-4 hover:underline">
            Oversikt
          </Link>
          , velg filtre og klikk «Lagre visning».
        </p>
      </div>
    );
  }

  function onUpdateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingView) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateReportView({
        id: editingView.id,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Visning oppdatert");
      setEditingView(null);
    });
  }

  function handleDelete() {
    if (!deletingView) return;

    startTransition(async () => {
      const result = await deleteReportView(deletingView.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Visning slettet");
      setDeletingView(null);
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Navn</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Filter</th>
              <th className="px-4 py-3 font-medium">Oppdatert</th>
              <th className="px-4 py-3 text-right font-medium">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {views.map((view) => (
              <tr key={view.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{view.name}</div>
                  {view.description ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {view.description}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {PAGE_TYPE_LABELS[view.page_type]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {describeReportViewConfig(view.page_type, view.config)}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {formatDate(view.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={buildPageUrl(view.page_type, view.config)}>
                        <ExternalLink />
                        Åpne
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal />
                          <span className="sr-only">Flere handlinger</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingView(view)}>
                          <Pencil />
                          Rediger
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingView(view)}
                        >
                          <Trash2 />
                          Slett
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editingView !== null}
        onOpenChange={(open) => !open && setEditingView(null)}
      >
        <DialogContent>
          {editingView ? (
            <form onSubmit={onUpdateSubmit}>
              <DialogHeader>
                <DialogTitle>Rediger rapportvisning</DialogTitle>
                <DialogDescription>
                  Endre navn og beskrivelse. For å endre filter, åpne visningen og
                  lagre på nytt fra siden.
                </DialogDescription>
              </DialogHeader>

              <div className="my-4 space-y-4">
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Filter: </span>
                  <span className="font-medium">
                    {describeReportViewConfig(
                      editingView.page_type,
                      editingView.config,
                    )}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-report-view-name">Navn</Label>
                  <Input
                    id="edit-report-view-name"
                    name="name"
                    defaultValue={editingView.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-report-view-description">Beskrivelse</Label>
                  <Textarea
                    id="edit-report-view-description"
                    name="description"
                    defaultValue={editingView.description ?? ""}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingView(null)}
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
                    "Lagre endringer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingView !== null}
        onOpenChange={(open) => !open && setDeletingView(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett rapportvisning?</DialogTitle>
            <DialogDescription>
              «{deletingView?.name}» slettes permanent. Dette kan ikke angres.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingView(null)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sletter…
                </>
              ) : (
                "Slett"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
