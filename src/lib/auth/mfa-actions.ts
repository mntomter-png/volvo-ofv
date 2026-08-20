"use server";

import { revalidatePath } from "next/cache";

import { assertSuper } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type MfaActionState = {
  error?: string;
  success?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

export async function startMfaEnrollment(
  _prev: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  void _prev;
  void formData;
  await assertSuper({ requireMfa: false });
  const supabase = await createClient();

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Volvo OFV",
  });

  if (error || !data) {
    console.error("[mfa] enroll failed:", error?.message);
    return { error: "Kunne ikke starte MFA-oppsett. Prøv igjen." };
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaEnrollment(
  _prev: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  await assertSuper({ requireMfa: false });

  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || !code) {
    return { error: "Mangler kode eller faktor-ID." };
  }

  const supabase = await createClient();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError || !challenge) {
    console.error("[mfa] challenge failed:", challengeError?.message);
    return { error: "Kunne ikke verifisere koden. Prøv igjen." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (error) {
    console.error("[mfa] verify failed:", error.message);
    return { error: "Ugyldig kode. Prøv igjen." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/sikkerhet");
  return { success: "Tofaktorautentisering er aktivert." };
}
