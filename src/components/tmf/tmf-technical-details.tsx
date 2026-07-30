"use client";

import { useState, type ReactNode } from "react";

import { MoreFiltersToggle } from "@/components/filters/filter-field";

export function TmfTechnicalDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <MoreFiltersToggle
        open={open}
        onToggle={() => setOpen((value) => !value)}
        closedLabel="Tekniske detaljer"
        openLabel="Skjul tekniske detaljer"
      />
      {open ? <div className="space-y-4">{children}</div> : null}
    </div>
  );
}
