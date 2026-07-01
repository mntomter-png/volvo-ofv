"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";

import { createUser, type AdminActionState } from "@/lib/auth/admin-actions";
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
} from "@/lib/auth/role-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      {pending ? <Loader2 className="animate-spin" /> : <Mail />}
      {pending ? "Sender …" : "Send invitasjon"}
    </Button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    createUser,
    {},
  );
  const [role, setRole] = useState<Role>("leder");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inviter ny bruker</CardTitle>
        <CardDescription>
          Legg inn e-post og rolle. Brukeren får en e-post med lenke for å sette
          eget passord og komme i gang.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <div className="space-y-2">
            <Label htmlFor="create-email">E-post</Label>
            <Input
              id="create-email"
              name="email"
              type="email"
              placeholder="navn@volvo.com"
              className="max-w-md"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-role">Rolle</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="create-role" className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESCRIPTIONS[role]}
            </p>
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
