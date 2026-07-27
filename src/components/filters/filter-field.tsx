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
