"use client";

import Link from "next/link";

import type { BrandConfig } from "@/lib/brand/config";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/lib/auth/role-config";

export function Sidebar({
  role,
  brand,
}: {
  role: Role | null;
  brand: BrandConfig;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center px-5">
        <div className="leading-tight">
          <p className="text-sm font-bold uppercase tracking-[0.22em]">
            {brand.appTitle}
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
            {brand.appTagline}
          </p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SidebarNav role={role} />
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="px-5 py-4">
        <Link
          href="/"
          className="block text-[11px] leading-relaxed text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/80"
        >
          Datakilde: OFV Statistikk
          <br />
          Internt verktøy · {brand.footerOrg}
        </Link>
      </div>
    </aside>
  );
}
