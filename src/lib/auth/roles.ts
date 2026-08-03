import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import {
  resolveRole,
  roleCanAccess,
  type AppPage,
  type Role,
} from "@/lib/auth/role-config";
import { firstAllowedRoute } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returnerer den kanoniske rollen til brukeren (fra app_metadata). */
export function getUserRole(user: User | null | undefined): Role {
  return resolveRole(user?.app_metadata?.role);
}

/** True hvis brukeren har super-rollen (full tilgang). */
export function isSuperUser(user: User | null | undefined): boolean {
  return getUserRole(user) === "super";
}

/** True hvis brukeren har tilgang til den gitte siden. */
export function canAccess(
  user: User | null | undefined,
  page: AppPage,
): boolean {
  return roleCanAccess(getUserRole(user), page);
}

/** Henter innlogget bruker (eller null) fra server-sesjonen. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Sikrer at innlogget bruker har tilgang til siden. Redirecter til login hvis
 * uautentisert, eller til brukerens første tillatte side hvis tilgang mangler.
 */
export async function requirePageAccess(page: AppPage): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!canAccess(user, page)) {
    redirect(firstAllowedRoute(getUserRole(user)));
  }
  return user;
}

/** Kaster hvis innlogget bruker ikke er super. Brukes i server actions. */
export async function assertSuper(): Promise<User> {
  const user = await getSessionUser();
  if (!isSuperUser(user)) {
    throw new Error("Du har ikke tilgang til denne handlingen.");
  }
  return user as User;
}

/** Super kan administrere fleet-VIN-register og se Fleet Sales-verktøy. */
export function canManageFleetVins(user: User | null | undefined): boolean {
  return isSuperUser(user);
}

export async function assertFleetManager(): Promise<User> {
  const user = await getSessionUser();
  if (!user || !canManageFleetVins(user)) {
    throw new Error("Du har ikke tilgang til å laste opp fleet-VIN-er.");
  }
  return user;
}
