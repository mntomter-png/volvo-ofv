"use client";

import { useActionState, useState } from "react";
import { KeyRound, Shield, ShieldOff, Trash2 } from "lucide-react";

import {
  deleteUser,
  resetUserPassword,
  setUserAdminRole,
  type AdminActionState,
} from "@/lib/auth/admin-actions";
import type { AuthUserRow } from "@/lib/auth/queries";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AuthUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    resetUserPassword,
    {},
  );

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tilbakestill passord</DialogTitle>
          <DialogDescription>
            Sett et nytt passord for <strong>{user.email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <div className="space-y-2">
            <label htmlFor="reset-password" className="text-sm font-medium">
              Nytt passord
            </label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              placeholder="Minst 8 tegn"
              minLength={8}
              required
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              {state.success}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" variant="accent">
              <KeyRound />
              Oppdater passord
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminRoleButton({ user }: { user: AuthUserRow }) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    setUserAdminRole,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="isAdmin" value={user.isAdmin ? "false" : "true"} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        title={user.isAdmin ? "Fjern admin-rolle" : "Gjør til admin"}
      >
        {user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
      </Button>
      {state.error ? (
        <span className="sr-only">{state.error}</span>
      ) : null}
    </form>
  );
}

function DeleteUserButton({
  user,
  currentUserId,
}: {
  user: AuthUserRow;
  currentUserId: string;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    deleteUser,
    {},
  );
  const isSelf = user.id === currentUserId;

  if (isSelf) return null;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(`Er du sikker på at du vil slette ${user.email}?`)
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={user.id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        title="Slett bruker"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: AuthUserRow[];
  currentUserId: string;
}) {
  const [resetUser, setResetUser] = useState<AuthUserRow | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Brukere ({users.length})</CardTitle>
          <CardDescription>
            Administrer kontoer, tilbakestill passord og tildel admin-rolle.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">E-post</th>
                  <th className="px-4 py-3 font-medium">Rolle</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Opprettet
                  </th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Sist innlogget
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.isAdmin ? (
                        <Badge variant="accent">Admin</Badge>
                      ) : (
                        <Badge variant="secondary">Bruker</Badge>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {user.lastSignInAt
                        ? formatDate(user.lastSignInAt)
                        : "Aldri"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Tilbakestill passord"
                          onClick={() => setResetUser(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <AdminRoleButton user={user} />
                        <DeleteUserButton
                          user={user}
                          currentUserId={currentUserId}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ResetPasswordDialog
        user={resetUser}
        open={resetUser !== null}
        onOpenChange={(open) => {
          if (!open) setResetUser(null);
        }}
      />
    </>
  );
}
