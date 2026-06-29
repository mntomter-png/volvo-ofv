"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

function safeRedirectPath(input: FormDataEntryValue | null): string {
  const value = typeof input === "string" ? input : "/";
  // Tillat kun interne stier for å unngå open redirect.
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));

  if (!email || !password) {
    return { error: "Fyll inn både e-post og passord." };
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
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
