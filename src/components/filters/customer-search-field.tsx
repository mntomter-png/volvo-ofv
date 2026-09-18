"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { parseCustomerSearch } from "@/lib/ofv/customer-search";
import { cn } from "@/lib/utils";

/** Hver commit trigger en ny server-render, så vi venter til brukeren tar pause. */
const DEBOUNCE_MS = 400;

interface CustomerSearchFieldProps {
  /** Gjeldende verdi fra URL-en (`?q=`). */
  value: string | null;
  onChange: (next: string | null) => void;
  isPending?: boolean;
  className?: string;
}

/** Fritekstsøk på eier/bruker – navn eller org.nr. */
export function CustomerSearchField({
  value,
  onChange,
  isPending,
  className,
}: CustomerSearchFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  /** Siste verdi vi selv har sendt til URL-en. */
  const committed = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Endringer utenfra (Nullstill filtre, bokmerke, tilbake-knapp) skal vises i feltet.
  // Våre egne commits hoppes over, ellers ville de overskrive det brukeren skriver.
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    const next = parseCustomerSearch(draft);
    if (next === committed.current) return;

    const timer = setTimeout(() => {
      committed.current = next;
      onChangeRef.current(next);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Navn eller org.nr. …"
        aria-label="Søk på eier eller bruker"
        className="pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
        data-pending={isPending ? "" : undefined}
      />
      {draft.length > 0 ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label="Tøm søk"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
