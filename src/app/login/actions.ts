"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

function safeRedirectPathFromForm(input: FormDataEntryValue | null): string {
  return safeRedirectPath(typeof input === "string" ? input : "/");
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectPathFromForm(formData.get("redirectTo"));

  if (!email || !password) {
    return { error: "Fyll inn både e-post og passord." };
  }

  if (!checkRateLimit(`login:${email.toLowerCase()}`, 8, 15 * 60 * 1000)) {
    return {
      error: "For mange innloggingsforsøk. Prøv igjen om noen minutter.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        "Innlogging mislyktes. Kontroller e-post og passord, og prøv igjen.",
    };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo as Route);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
