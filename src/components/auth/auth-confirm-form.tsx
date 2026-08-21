"use client";

import { useFormStatus } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
      {pending ? "Bekrefter …" : "Fortsett"}
    </Button>
  );
}

export function AuthConfirmForm({
  tokenHash,
  type,
  code,
  next,
}: {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
  next: string;
}) {
  return (
    <form method="post" action="/auth/exchange" className="space-y-3">
      {tokenHash ? (
        <input type="hidden" name="token_hash" value={tokenHash} />
      ) : null}
      {type ? <input type="hidden" name="type" value={type} /> : null}
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <input type="hidden" name="next" value={next} />
      <SubmitButton />
    </form>
  );
}
