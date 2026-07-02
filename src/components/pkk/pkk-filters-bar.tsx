"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger, parseAsBoolean } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  PKK_MIN_FLEET_OPTIONS,
  type PkkMinFleet,
} from "@/lib/pkk/filters";
import { REGION_FILTER_OPTIONS } from "@/lib/ofv/segmentation";

const ALL_VALUE = "__all__";

interface PkkFiltersBarProps {
  showRegions: boolean;
}

export function PkkFiltersBar({ showRegions }: PkkFiltersBarProps) {
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [region, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [minFleetRaw, setMinFleet] = useQueryState(
    "minFleet",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [onlyFollowUp, setOnlyFollowUp] = useQueryState(
    "followUp",
    parseAsBoolean.withDefault(false).withOptions(nuqsOptions),
  );

  const minFleet = (minFleetRaw ?? 5) as PkkMinFleet;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium text-foreground">Filtrer</span>

      {showRegions ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region</span>
          <Select
            value={region != null ? String(region) : ALL_VALUE}
            onValueChange={(value) => {
              setRegion(value === ALL_VALUE ? null : Number.parseInt(value, 10));
            }}
          >
            <SelectTrigger
              className="w-[180px]"
              data-pending={isPending ? "" : undefined}
            >
              <SelectValue placeholder="Alle regioner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Alle regioner</SelectItem>
              {REGION_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Storkunde</span>
        <Select
          value={String(minFleet)}
          onValueChange={(value) => {
            setMinFleet(Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger
            className="w-[180px]"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PKK_MIN_FLEET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="pkk-follow-up"
          type="checkbox"
          checked={onlyFollowUp}
          onChange={(event) => setOnlyFollowUp(event.target.checked)}
          className="h-4 w-4 rounded border-border accent-volvo-blue"
          data-pending={isPending ? "" : undefined}
        />
        <Label htmlFor="pkk-follow-up" className="cursor-pointer text-sm">
          Kun kunder som trenger oppfølging
        </Label>
      </div>
    </div>
  );
}
