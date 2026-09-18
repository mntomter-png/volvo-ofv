"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  CUSTOMER_SEARCH_MIN_LENGTH,
  parseCustomerSearch,
} from "@/lib/ofv/customer-search";
import {
  fetchCustomerSuggestions,
  type CustomerSearchSource,
  type CustomerSuggestion,
} from "@/lib/ofv/customer-suggestions";
import { cn } from "@/lib/utils";

/** Forslagene er ett RPC-kall, så de kan komme raskt mens brukeren skriver. */
const SUGGEST_DEBOUNCE_MS = 200;

interface CustomerSearchFieldProps {
  /** Gjeldende verdi fra URL-en (`?q=`). */
  value: string | null;
  onChange: (next: string | null) => void;
  /** Hvilket datagrunnlag forslagene skal hentes fra. */
  source: CustomerSearchSource;
  /** Årsfilteret på nyregistreringer – forslag utenfor året er ikke til hjelp. */
  year?: number | null;
  from?: string | null;
  to?: string | null;
  isPending?: boolean;
  className?: string;
}

/** Fritekstsøk på eier/bruker, med forslag om konkrete kunder. */
export function CustomerSearchField({
  value,
  onChange,
  source,
  year,
  from,
  to,
  isPending,
  className,
}: CustomerSearchFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [focusMake, setFocusMake] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** -1 = ingen markert, da sender Enter fritekstsøket. */
  const [activeIndex, setActiveIndex] = useState(-1);

  /** Siste verdi vi selv har sendt til URL-en. */
  const committed = useRef(value);
  const onChangeRef = useRef(onChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  /** Forkaster svar som kommer ut av rekkefølge. */
  const requestId = useRef(0);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useEffect(() => {
    onChangeRef.current = onChange;
  });
  draftRef.current = draft;

  // Endringer utenfra (Nullstill filtre, bokmerke, tilbake-knapp) skal vises i feltet.
  // Våre egne commits hoppes over, ellers ville de overskrive det brukeren skriver.
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setDraft(value ?? "");
    setIsOpen(false);
  }, [value]);

  useEffect(() => {
    const query = parseCustomerSearch(draft);
    if (!query) {
      requestId.current += 1;
      setSuggestions([]);
      setHasFetched(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    const timer = setTimeout(() => {
      void fetchCustomerSuggestions({ source, query, year, from, to })
        .then((result) => {
          if (id !== requestId.current) return;
          setSuggestions(result.suggestions);
          setFocusMake(result.focusMake);
          setError(result.error ?? null);
          setActiveIndex(-1);
          setHasFetched(true);
          setIsLoading(false);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setSuggestions([]);
          setError("Kunne ikke hente kundeforslag.");
          setHasFetched(true);
          setIsLoading(false);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, source, year, from, to]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  function commit(nextDraft: string) {
    const next = parseCustomerSearch(nextDraft);
    if (next === committed.current) return;
    committed.current = next;
    onChangeRef.current(next);
  }

  function select(suggestion: CustomerSuggestion) {
    setDraft(suggestion.name);
    setIsOpen(false);
    setActiveIndex(-1);
    commit(suggestion.name);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(event.key === "ArrowDown" ? 0 : suggestions.length - 1);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 inngår i syklusen, så brukeren kan gå tilbake til sin egen tekst.
      const span = suggestions.length + 1;
      setActiveIndex(((activeIndex + 1 + step + span) % span) - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (isOpen && activeIndex >= 0) {
        const suggestion = suggestions[activeIndex];
        if (suggestion) {
          select(suggestion);
          return;
        }
      }
      setIsOpen(false);
      commit(draft);
    }
  }

  const query = parseCustomerSearch(draft);
  const showList = isOpen && query != null;
  const showEmpty =
    showList && hasFetched && !isLoading && suggestions.length === 0;

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        role="combobox"
        aria-expanded={showList && (suggestions.length > 0 || showEmpty)}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={(event) => {
          // Tøm-knappen og forslagene ligger i samme container; de skal
          // håndtere commit selv. Uten dette ville blur lagret utkastet
          // før klikket rakk å tømme feltet.
          if (containerRef.current?.contains(event.relatedTarget as Node)) {
            return;
          }
          commit(draftRef.current);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Søk og velg kunde …"
        aria-label="Søk på eier eller bruker"
        className="pl-8 pr-8"
        data-pending={isPending ? "" : undefined}
      />
      {isLoading && draft.length >= CUSTOMER_SEARCH_MIN_LENGTH ? (
        <Loader2 className="pointer-events-none absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {draft.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setIsOpen(false);
            commit("");
          }}
          aria-label="Tøm søk"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {showList && (suggestions.length > 0 || showEmpty) ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Kundeforslag"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-72 overflow-y-auto rounded-md border bg-popover py-1 shadow-md"
        >
          {showEmpty ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {error
                ? error
                : `Ingen kunder matcher «${query}». Enter søker likevel på teksten.`}
            </li>
          ) : (
            <>
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.name}-${index}`} role="presentation">
                  <button
                    type="button"
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    // Mousedown-lytteren utenfor ville ellers lukke lista før klikket traff.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(suggestion)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left",
                      index === activeIndex && "bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {suggestion.name}
                      </span>
                      {suggestion.orgnr ? (
                        <span className="block text-xs text-muted-foreground">
                          Org.nr. {suggestion.orgnr}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {suggestion.vehicleCount} kjøretøy
                      {suggestion.focusCount > 0 && focusMake
                        ? ` · ${suggestion.focusCount} ${focusMake}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
              <li className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                {activeIndex >= 0
                  ? "Enter velger kunden"
                  : `Enter søker på «${query}»`}
              </li>
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}
