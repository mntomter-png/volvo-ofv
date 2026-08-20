"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";

import { ROLES, resolveRole, type Role } from "@/lib/auth/role-config";
import {
  BRAND_IDS,
  resolveBrandId,
  type BrandId,
} from "@/lib/brand/config";
import { assertSuper } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/auth/audit-log";
import { MFA_REQUIRED_MESSAGE } from "@/lib/auth/mfa";
import { validatePassword } from "@/lib/auth/password-policy";
import { toSafeAdminError } from "@/lib/auth/safe-admin-error";
import { authCallbackUrl } from "@/lib/auth/site-url.server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionState = {
  error?: string;
  success?: string;
};

function adminAccessError(error: unknown): string {
  if (error instanceof Error && error.message === MFA_REQUIRED_MESSAGE) {
    return MFA_REQUIRED_MESSAGE;
  }
  return "Du har ikke tilgang til denne handlingen.";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

function parseBrand(value: unknown): BrandId | null {
  return typeof value === "string" &&
    (BRAND_IDS as readonly string[]).includes(value)
    ? (value as BrandId)
    : null;
}

export async function createUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let actor: User;
  try {
    actor = await assertSuper();
  } catch (error) {
    return { error: adminAccessError(error) };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(formData.get("role"));
  const brand = parseBrand(formData.get("brand")) ?? "volvo";

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
  const redirectTo = authCallbackUrl("/oppdater-passord");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("[admin] inviteUserByEmail failed:", error.message, {
      redirectTo,
    });
    return {
      error: toSafeAdminError(error, "Kunne ikke sende invitasjon. Prøv igjen."),
    };
  }

  const invited = data.user;
  if (!invited) {
    return { error: "Kunne ikke sende invitasjon. Prøv igjen." };
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(
    invited.id,
    { app_metadata: { role, brand } },
  );
  if (roleError) {
    console.error("[admin] invite role set failed:", roleError.message);
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      invited.id,
    );
    if (deleteError) {
      console.error(
        "[admin] invite rollback delete failed:",
        deleteError.message,
        { userId: invited.id },
      );
    }
    return {
      error:
        "Kunne ikke fullføre invitasjonen (rolle). Ingen bruker ble stående igjen — prøv igjen.",
    };
  }

  await logAdminAudit({
    actor,
    action: "user.invite",
    targetUserId: invited.id,
    metadata: { email, role, brand },
  });

  revalidatePath("/admin/brukere");
  return {
    success: `Invitasjon sendt til ${email}. Brukeren får en lenke for å sette passord.`,
  };
}

export async function resetUserPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let actor: User;
  try {
    actor = await assertSuper();
  } catch (error) {
    return { error: adminAccessError(error) };
  }

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!userId || !password) {
    return { error: "Mangler bruker-ID eller passord." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return {
      error: toSafeAdminError(error, "Kunne ikke oppdatere passordet. Prøv igjen."),
    };
  }

  await logAdminAudit({
    actor,
    action: "user.password_reset",
    targetUserId: userId,
  });

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
  } catch (error) {
    return { error: adminAccessError(error) };
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
    return {
      error: toSafeAdminError(error, "Kunne ikke slette brukeren. Prøv igjen."),
    };
  }

  await logAdminAudit({
    actor: currentUser,
    action: "user.delete",
    targetUserId: userId,
  });

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
  } catch (error) {
    return { error: adminAccessError(error) };
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
  const { data: existing, error: fetchError } =
    await admin.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return {
      error: toSafeAdminError(fetchError, "Fant ikke brukeren."),
    };
  }

  const brand = resolveBrandId(existing.user.app_metadata?.brand);
  const previousRole = resolveRole(existing.user.app_metadata?.role);
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role, brand },
  });

  if (error) {
    return {
      error: toSafeAdminError(error, "Kunne ikke oppdatere rollen. Prøv igjen."),
    };
  }

  await logAdminAudit({
    actor: currentUser,
    action: "user.role_change",
    targetUserId: userId,
    metadata: { previousRole, newRole: role, brand },
  });

  revalidatePath("/admin/brukere");
  return { success: "Rollen er oppdatert." };
}
