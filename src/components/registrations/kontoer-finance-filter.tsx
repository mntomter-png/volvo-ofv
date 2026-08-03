"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import { Label } from "@/components/ui/label";

/** Toggle for å skjule finans/leasing på Kundeutvikling (default: skjult). */
export function KontoerFinanceFilter() {
  const [isPending, startTransition] = useTransition();
  const [excludeFinance, setExcludeFinance] = useQueryState("excludeFinance", {
    defaultValue: "1",
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });

  return (
    <div className="mb-4 flex items-center gap-2" data-pending={isPending ? "" : undefined}>
      <input
        id="kontoer-exclude-finance"
        type="checkbox"
        checked={excludeFinance !== "0"}
        onChange={(event) =>
          setExcludeFinance(event.target.checked ? "1" : "0")
        }
        className="h-4 w-4 rounded border-border accent-volvo-blue"
      />
      <Label htmlFor="kontoer-exclude-finance" className="cursor-pointer text-sm">
        Skjul finans og leasing
      </Label>
    </div>
  );
}
