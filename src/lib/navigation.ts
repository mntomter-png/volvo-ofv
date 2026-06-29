import type { Route } from "next";
import {
  BookMarked,
  LayoutDashboard,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  description: string;
};

export const navItems: NavItem[] = [
  {
    title: "Oversikt",
    href: "/",
    icon: LayoutDashboard,
    description: "Nøkkeltall og sammendrag",
  },
  {
    title: "Nyregistreringer",
    href: "/nyregistreringer",
    icon: TrendingUp,
    description: "Registreringsstatistikk over tid",
  },
  {
    title: "Populasjon / Bestand",
    href: "/populasjon",
    icon: Truck,
    description: "Kjøretøypopulasjon og bestand",
  },
  {
    title: "Rapportvisninger",
    href: "/rapportvisninger",
    icon: BookMarked,
    description: "Dine lagrede, personlige visninger",
  },
];
