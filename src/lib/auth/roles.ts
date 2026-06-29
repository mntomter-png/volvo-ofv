import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/** Returnerer true hvis brukeren har admin-rollen (satt i app_metadata). */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}

/** Henter innlogget bruker (eller null) fra server-sesjonen. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Kaster hvis innlogget bruker ikke er admin. Brukes i server actions. */
export async function assertAdmin(): Promise<User> {
  const user = await getSessionUser();
  if (!isAdminUser(user)) {
    throw new Error("Du har ikke tilgang til denne handlingen.");
  }
  return user as User;
}
