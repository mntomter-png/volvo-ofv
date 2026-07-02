"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  savePkkCustomerNote,
  type PkkCustomerNote,
} from "@/lib/pkk/note-actions";

export function PkkCustomerContact({
  ownerKey,
  initialNote,
}: {
  ownerKey: string;
  initialNote: PkkCustomerNote;
}) {
  const [contactEmail, setContactEmail] = useState(initialNote.contactEmail);
  const [note, setNote] = useState(initialNote.note);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.MouseEvent) {
    event.stopPropagation();

    startTransition(async () => {
      const result = await savePkkCustomerNote(ownerKey, contactEmail, note);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Kontaktinfo lagret");
    });
  }

  return (
    <div
      className="border-t border-border bg-card px-4 py-4"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Oppfølging
      </p>
      <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_1fr_auto] md:items-start">
        <div className="space-y-1.5">
          <label
            htmlFor={`email-${ownerKey}`}
            className="text-xs text-muted-foreground"
          >
            Kontakt e-post
          </label>
          <Input
            id={`email-${ownerKey}`}
            type="email"
            placeholder="kontakt@firma.no"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`note-${ownerKey}`}
            className="text-xs text-muted-foreground"
          >
            Notat
          </label>
          <Textarea
            id={`note-${ownerKey}`}
            placeholder="Sist kontaktet, avtale, oppfølging …"
            value={note}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-6 md:mt-5"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lagre
        </Button>
      </div>
    </div>
  );
}
