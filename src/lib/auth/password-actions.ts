"use server";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { validatePassword } from "@/lib/auth/password-policy";
import { authCallbackUrl } from "@/lib/auth/site-url.server";
import { createClient } from "@/lib/supabase/server";

export type PasswordActionState = {
  error?: string;
  success?: string;
};

export async function requestPasswordReset(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Fyll inn e-postadressen din." };
  }

  const normalizedEmail = email.toLowerCase();
  if (
    !(await checkRateLimit(`password-reset:${normalizedEmail}`, 3, 60 * 60 * 1000))
  ) {
    return {
      error: "For mange forespørsler. Prøv igjen om en time.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/oppdater-passord"),
  });

  if (error) {
    return { error: "Kunne ikke sende e-post. Prøv igjen senere." };
  }

  // Samme melding uansett om e-post finnes (unngår oppslag av brukere).
  return {
    success:
      "Hvis e-posten finnes i systemet, har vi sendt deg en lenke for å tilbakestille passordet. Sjekk innboksen din.",
  };
}

export async function updatePassword(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || !confirm) {
    return { error: "Fyll inn begge passordfeltene." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }
  if (password !== confirm) {
    return { error: "Passordene stemmer ikke overens." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Kunne ikke oppdatere passordet. Prøv igjen." };
  }

  return { success: "Passordet er satt. Du er klar til å bruke appen." };
}
