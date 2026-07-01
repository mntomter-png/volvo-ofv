"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";

import { ROLES, type Role } from "@/lib/auth/role-config";
import { assertSuper } from "@/lib/auth/roles";
import { authCallbackUrl } from "@/lib/auth/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionState = {
  error?: string;
  success?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

export async function createUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await assertSuper();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(formData.get("role"));

  if (!email) {
    return { error: "Fyll inn e-postadresse." };
  }
  if (!isValidEmail(email)) {
    return { error: "Ugyldig e-postadresse." };
  }
  if (!role) {
    return { error: "Velg en gyldig rolle." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: authCallbackUrl("/oppdater-passord"),
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "En bruker med denne e-posten finnes allerede." };
    }
    return { error: error.message };
  }

  if (data.user) {
    const { error: roleError } = await admin.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: { role } },
    );
    if (roleError) {
      return {
        error: `Invitasjon sendt, men rollen kunne ikke settes: ${roleError.message}`,
      };
    }
  }

  revalidatePath("/admin/brukere");
  return {
    success: `Invitasjon sendt til ${email}. Brukeren får en lenke for å sette passord.`,
  };
}

export async function resetUserPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await assertSuper();
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
    currentUser = await assertSuper();
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

export async function setUserRole(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let currentUser: User;
  try {
    currentUser = await assertSuper();
  } catch {
    return { error: "Du har ikke tilgang til denne handlingen." };
  }

  const userId = String(formData.get("userId") ?? "");
  const role = parseRole(formData.get("role"));

  if (!userId) {
    return { error: "Mangler bruker-ID." };
  }
  if (!role) {
    return { error: "Ugyldig rolle." };
  }
  if (userId === currentUser.id && role !== "super") {
    return { error: "Du kan ikke fjerne din egen super-tilgang." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/brukere");
  return { success: "Rollen er oppdatert." };
}
