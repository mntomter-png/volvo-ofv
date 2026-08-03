"use client";

import { useEffect, useMemo, useTransition } from "react";
import { parseAsInteger, useQueryState } from "nuqs";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDistrictFilterOptionsForRegion } from "@/lib/ofv/segmentation";

const ALL_VALUE = "__all__";

/** Distrikt + finans-toggle på Kundeutvikling. */
export function KontoerFinanceFilter() {
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [region] = useQueryState("region", parseAsInteger.withOptions(nuqsOptions));
  const [district, setDistrict] = useQueryState("district", nuqsOptions);
  const [excludeFinance, setExcludeFinance] = useQueryState("excludeFinance", {
    defaultValue: "1",
    ...nuqsOptions,
  });

  const districtOptions = useMemo(
    () => getDistrictFilterOptionsForRegion(region),
    [region],
  );

  useEffect(() => {
    if (
      district &&
      !districtOptions.some((option) => option.value === district)
    ) {
      void setDistrict(null);
    }
  }, [district, districtOptions, setDistrict]);

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-4"
      data-pending={isPending ? "" : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Distrikt</span>
        <Select
          value={district ?? ALL_VALUE}
          onValueChange={(value) => {
            setDistrict(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Alle distrikter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle distrikter</SelectItem>
            {districtOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
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
    </div>
  );
}
