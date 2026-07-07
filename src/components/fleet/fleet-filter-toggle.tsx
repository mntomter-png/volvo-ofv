"use client";

import { cn } from "@/lib/utils";
import {
  FLEET_FILTER_LABELS,
  type FleetFilter,
} from "@/lib/fleet";

const OPTIONS: FleetFilter[] = ["all", "region", "fleet"];

export function FleetFilterToggle({
  value,
  onChange,
  fleetVinCount,
  className,
}: {
  value: FleetFilter;
  onChange: (value: FleetFilter) => void;
  fleetVinCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              value === option
                ? "border-volvo-blue bg-volvo-blue text-white"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {FLEET_FILTER_LABELS[option]}
          </button>
        ))}
      </div>
      {fleetVinCount != null ? (
        <p className="text-xs text-muted-foreground">
          Fleet VIN lastet: <span className="font-medium">{fleetVinCount}</span>{" "}
          (dealer 896)
        </p>
      ) : null}
    </div>
  );
}
