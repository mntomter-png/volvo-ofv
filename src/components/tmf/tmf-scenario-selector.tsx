"use client";

import { useQueryState } from "nuqs";

import { TMF_SCENARIO_OPTIONS } from "@/lib/tmf/scenarios";
import { cn } from "@/lib/utils";

export function TmfScenarioSelector() {
  const [scenario, setScenario] = useQueryState("scenario", {
    defaultValue: "basis",
    shallow: false,
  });

  return (
    <div className="flex flex-wrap gap-2">
      {TMF_SCENARIO_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setScenario(option.id)}
          className={cn(
            "rounded-lg border px-4 py-2 text-left transition-colors",
            scenario === option.id
              ? "border-volvo-blue bg-volvo-blue/5"
              : "border-border hover:bg-muted/50",
          )}
        >
          <p className="font-medium text-sm">{option.label}</p>
          <p className="text-muted-foreground text-xs">{option.description}</p>
        </button>
      ))}
    </div>
  );
}
