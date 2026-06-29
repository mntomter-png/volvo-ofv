"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";

import { assertAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionState = {
  error?: string;
  success?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Fyll inn både e-post og passord." };
  }
  if (!isValidEmail(email)) {
    return { error: "Ugyldig e-postadresse." };
  }
  if (password.length < 8) {
    return { error: "Passordet må være minst 8 tegn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "En bruker med denne e-posten finnes allerede." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/brukere");
  return { success: `Bruker ${email} er opprettet.` };
}

export async function resetUserPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!userId || !password) {
    return { error: "Mangler bruker-ID eller passord." };
  }
  if (password.length < 8) {
    return { error: "Passordet må være minst 8 tegn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/brukere");
  return { success: "Passordet er oppdatert." };
}

export async function deleteUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let currentUser: User;
  try {
    currentUser = await assertAdmin();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    return { error: "Mangler bruker-ID." };
  }
  if (userId === currentUser.id) {
    return { error: "Du kan ikke slette din egen konto." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/brukere");
  return { success: "Brukeren er slettet." };
}

export async function setUserAdminRole(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const userId = String(formData.get("userId") ?? "");
  const isAdmin = formData.get("isAdmin") === "true";

  if (!userId) {
    return { error: "Mangler bruker-ID." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: isAdmin ? "admin" : "user" },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/brukere");
  return {
    success: isAdmin ? "Brukeren er satt som admin." : "Admin-rolle fjernet.",
  };
}
