"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, UserPlus } from "lucide-react";

import { createUser, type AdminActionState } from "@/lib/auth/admin-actions";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
      {pending ? "Oppretter …" : "Opprett bruker"}
    </Button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    createUser,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opprett ny bruker</CardTitle>
        <CardDescription>
          Opprett en konto for en kollega. E-posten bekreftes automatisk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-email">E-post</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                placeholder="navn@volvo.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Midlertidig passord</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                placeholder="Minst 8 tegn"
                minLength={8}
                required
              />
            </div>
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              {state.success}
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
