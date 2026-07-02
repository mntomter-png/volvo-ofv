import type { Route } from "next";
import {
  BookMarked,
  ClipboardCheck,
  LayoutDashboard,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  roleCanAccess,
  type AppPage,
  type Role,
} from "@/lib/auth/role-config";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  description: string;
  page: AppPage;
};

export const navItems: NavItem[] = [
  {
    title: "Oversikt",
    href: "/",
    icon: LayoutDashboard,
    description: "Nøkkeltall og sammendrag",
    page: "dashboard",
  },
  {
    title: "Nyregistreringer",
    href: "/nyregistreringer",
    icon: TrendingUp,
    description: "Registreringsstatistikk over tid",
    page: "nyregistreringer",
  },
  {
    title: "Populasjon / Bestand",
    href: "/populasjon",
    icon: Truck,
    description: "Kjøretøypopulasjon og bestand",
    page: "populasjon",
  },
  {
    title: "PKK",
    href: "/pkk" as Route,
    icon: ClipboardCheck,
    description: "Storkundeoppfølging på PKK-frister",
    page: "pkk",
  },
  {
    title: "Rapportvisninger",
    href: "/rapportvisninger",
    icon: BookMarked,
    description: "Dine lagrede, personlige visninger",
    page: "rapportvisninger",
  },
];

/** Kun synlig for super-brukere. */
export const adminNavItem: NavItem = {
  title: "Brukere",
  href: "/admin/brukere" as Route,
  icon: Users,
  description: "Administrer brukerkontoer",
  page: "admin",
};

/** Alle navigasjonselementer, inkludert admin, i visningsrekkefølge. */
export const allNavItems: NavItem[] = [...navItems, adminNavItem];

/** Navigasjonselementer en gitt rolle har tilgang til. */
export function navItemsForRole(role: Role): NavItem[] {
  return allNavItems.filter((item) => roleCanAccess(role, item.page));
}

/** Første tilgjengelige rute for rollen (brukes til landings-redirect). */
export function firstAllowedRoute(role: Role): Route {
  const first = allNavItems.find((item) => roleCanAccess(role, item.page));
  return first?.href ?? ("/login" as Route);
}
