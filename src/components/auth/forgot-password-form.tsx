"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

import {
  requestPasswordReset,
  type PasswordActionState,
} from "@/lib/auth/password-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Mail />}
      {pending ? "Sender …" : "Send tilbakestillingslenke"}
    </Button>
  );
}

export function ForgotPasswordForm({
  initialError,
}: {
  initialError?: string;
}) {
  const [state, formAction] = useActionState<PasswordActionState, FormData>(
    requestPasswordReset,
    initialError ? { error: initialError } : {},
  );

  return (
    <div className="space-y-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Tilbake til innlogging
      </Link>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          Glemt passord?
        </h2>
        <p className="text-sm text-muted-foreground">
          Skriv inn e-posten din, så sender vi en lenke for å tilbakestille
          passordet.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Jobb-e-post</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="navn@volvo.com"
            required
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
            role="status"
          >
            {state.success}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </div>
  );
}
