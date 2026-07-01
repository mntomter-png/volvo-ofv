"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import {
  DEFAULT_REGISTRATIONS_TAB,
  REGISTRATIONS_TABS,
  type RegistrationsTabId,
} from "@/lib/registrations/tabs";
import { cn } from "@/lib/utils";

interface RegistrationsTabNavProps {
  /** Server-valgt fane (fallback ved første render). */
  activeTab: RegistrationsTabId;
}

export function RegistrationsTabNav({ activeTab }: RegistrationsTabNavProps) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useQueryState("tab", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
    defaultValue: DEFAULT_REGISTRATIONS_TAB,
  });

  const current = tab ?? activeTab;

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 border-b border-border"
      aria-label="Nyregistreringer"
    >
      {REGISTRATIONS_TABS.map((item) => {
        const isActive = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id === DEFAULT_REGISTRATIONS_TAB ? null : item.id)}
            data-pending={isPending ? "" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
