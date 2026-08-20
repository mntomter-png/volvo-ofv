import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import {
  MFA_REQUIRED_MESSAGE,
  userHasVerifiedMfa,
} from "@/lib/auth/mfa";
import {
  resolveRole,
  roleCanAccess,
  type AppPage,
  type Role,
} from "@/lib/auth/role-config";
import { getUserBrandId } from "@/lib/brand/user-brand";
import { firstAllowedRoute } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returnerer kanonisk rolle, eller null hvis ukjent/mangler (ingen tilgang). */
export function getUserRole(user: User | null | undefined): Role | null {
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

function hasValidBrand(user: User): boolean {
  return getUserBrandId(user) != null;
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
 * uautentisert, eller til første tillatte side / ingen-tilgang.
 */
export async function requirePageAccess(page: AppPage): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!hasValidBrand(user) || !canAccess(user, page)) {
    redirect(firstAllowedRoute(getUserRole(user)));
  }
  return user;
}

/**
 * Side-tilgang for server actions (kaster, aldri redirect).
 * Bruk i actions som returnerer { error } eller forventer try/catch.
 */
export async function assertPageAccess(page: AppPage): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Ikke innlogget.");
  }
  if (!hasValidBrand(user)) {
    throw new Error("Kontoen mangler gyldig merkevare.");
  }
  if (!canAccess(user, page)) {
    const role = getUserRole(user);
    throw new Error(
      role
        ? "Du har ikke tilgang til denne handlingen."
        : "Kontoen mangler gyldig rolle.",
    );
  }
  return user;
}

export type AssertSuperOptions = {
  /**
   * Default true. Sett false kun for MFA-oppsett (ellers chicken-egg).
   * Admin-handlinger skal alltid kreve MFA.
   */
  requireMfa?: boolean;
};

/** Kaster hvis innlogget bruker ikke er super (og mangler MFA når krevd). */
export async function assertSuper(
  options?: AssertSuperOptions,
): Promise<User> {
  const user = await getSessionUser();
  if (!isSuperUser(user)) {
    throw new Error("Du har ikke tilgang til denne handlingen.");
  }
  const requireMfa = options?.requireMfa !== false;
  if (requireMfa && !(await userHasVerifiedMfa())) {
    throw new Error(MFA_REQUIRED_MESSAGE);
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
