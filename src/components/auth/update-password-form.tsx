"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { KeyRound, Loader2 } from "lucide-react";

import {
  updatePassword,
  type PasswordActionState,
} from "@/lib/auth/password-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
      {pending ? "Lagrer …" : "Sett passord"}
    </Button>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState<PasswordActionState, FormData>(
    updatePassword,
    {},
  );

  if (state.success) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          {state.success}
        </p>
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href="/">Gå til oversikten</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          Sett passordet ditt
        </h2>
        <p className="text-sm text-muted-foreground">
          Velg et passord for å fullføre kontoen og komme i gang.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Nytt passord</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minst 8 tegn"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Bekreft passord</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Gjenta passordet"
            minLength={8}
            required
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </div>
  );
}
