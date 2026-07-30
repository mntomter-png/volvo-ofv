import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Responsiv filterrad: 1 kolonne på mobil, flere på større skjermer. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Ett filterfelt med label over kontrollen (full bredde i grid-cellen). */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Kompakt primærrad: tid + vanligste dimensjoner side om side på desktop. */
export function PrimaryFilterRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Toggle for å vise/skjule sekundære filtre uten å miste oversikt. */
export function MoreFiltersToggle({
  open,
  onToggle,
  activeCount = 0,
  closedLabel = "Flere filtre",
  openLabel = "Skjul flere filtre",
}: {
  open: boolean;
  onToggle: () => void;
  activeCount?: number;
  closedLabel?: string;
  openLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
      {open ? openLabel : closedLabel}
      {activeCount > 0 ? (
        <span className="rounded-md bg-volvo-blue/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-volvo-blue">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}
