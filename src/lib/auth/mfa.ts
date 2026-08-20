import "server-only";

import { createClient } from "@/lib/supabase/server";

/** True hvis innlogget bruker har minst én verifisert TOTP-faktor. */
export async function userHasVerifiedMfa(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("[mfa] listFactors failed:", error.message);
    return false;
  }
  return (data.totp ?? []).some((factor) => factor.status === "verified");
}

export const MFA_REQUIRED_MESSAGE =
  "Tofaktorautentisering kreves. Gå til Admin → Sikkerhet og aktiver MFA.";
