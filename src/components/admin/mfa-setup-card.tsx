"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";

import {
  startMfaEnrollment,
  verifyMfaEnrollment,
  type MfaActionState,
} from "@/lib/auth/mfa-actions";
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

function ActionButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function MfaSetupCard({ alreadyEnabled }: { alreadyEnabled: boolean }) {
  const [enrollState, enrollAction] = useActionState<MfaActionState, FormData>(
    startMfaEnrollment,
    {},
  );
  const [verifyState, verifyAction] = useActionState<MfaActionState, FormData>(
    verifyMfaEnrollment,
    {},
  );

  if (alreadyEnabled || verifyState.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tofaktorautentisering</CardTitle>
          <CardDescription>
            MFA er aktivert for kontoen din. Bruk autentiseringsappen ved
            innlogging når Supabase ber om det.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {verifyState.success ?? "Status: aktiv"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const factorId = enrollState.factorId;
  const qrCode = enrollState.qrCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tofaktorautentisering</CardTitle>
        <CardDescription>
          Skann QR-koden med en autentiseringsapp (f.eks. Google Authenticator
          eller 1Password), og bekreft med engangskode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!factorId ? (
          <form action={enrollAction}>
            {enrollState.error ? (
              <p className="mb-3 text-sm text-destructive" role="alert">
                {enrollState.error}
              </p>
            ) : null}
            <ActionButton
              label="Start MFA-oppsett"
              pendingLabel="Starter …"
            />
          </form>
        ) : (
          <div className="space-y-4">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="QR-kode for MFA"
                className="h-48 w-48 rounded-md border border-border bg-white p-2"
              />
            ) : null}
            {enrollState.secret ? (
              <p className="text-xs text-muted-foreground break-all">
                Manuell nøkkel: {enrollState.secret}
              </p>
            ) : null}
            <form action={verifyAction} className="space-y-3">
              <input type="hidden" name="factorId" value={factorId} />
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Engangskode</Label>
                <Input
                  id="mfa-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 siffer"
                  required
                />
              </div>
              {verifyState.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {verifyState.error}
                </p>
              ) : null}
              <ActionButton label="Bekreft MFA" pendingLabel="Verifiserer …" />
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
