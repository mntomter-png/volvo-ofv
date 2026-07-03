"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger, parseAsStringLiteral } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  PKK_CUSTOMER_PARTY_OPTIONS,
  PKK_HORIZON_OPTIONS,
  PKK_MIN_FLEET_OPTIONS,
  pkkCustomerPartyLabel,
  pkkHorizonDescription,
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
  const [horizon, setHorizon] = useQueryState(
    "horizon",
    parseAsStringLiteral(["actionable", "upcoming", "all"] as const)
      .withDefault("actionable")
      .withOptions(nuqsOptions),
  );
  const [onlyFollowUp, setOnlyFollowUp] = useQueryState(
    "followUp",
    parseAsStringLiteral(["0", "1"] as const)
      .withDefault("1")
      .withOptions(nuqsOptions),
  );
  const [excludeFinance, setExcludeFinance] = useQueryState(
    "excludeFinance",
    parseAsStringLiteral(["0", "1"] as const)
      .withDefault("1")
      .withOptions(nuqsOptions),
  );
  const [party, setParty] = useQueryState(
    "party",
    parseAsStringLiteral(["owner", "user"] as const)
      .withDefault("owner")
      .withOptions(nuqsOptions),
  );

  const minFleet = (minFleetRaw ?? 5) as PkkMinFleet;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
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
          <span className="text-sm text-muted-foreground">Kunde</span>
          <Select
            value={party}
            onValueChange={(value) => {
              setParty(value as typeof party);
            }}
          >
            <SelectTrigger
              className="w-[140px]"
              data-pending={isPending ? "" : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PKK_CUSTOMER_PARTY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <span className="text-sm text-muted-foreground">Fristvindu</span>
          <Select
            value={horizon}
            onValueChange={(value) => {
              setHorizon(value as typeof horizon);
            }}
          >
            <SelectTrigger
              className="w-[280px]"
              data-pending={isPending ? "" : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PKK_HORIZON_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="pkk-exclude-finance"
            type="checkbox"
            checked={excludeFinance === "1"}
            onChange={(event) =>
              setExcludeFinance(event.target.checked ? "1" : "0")
            }
            className="h-4 w-4 rounded border-border accent-volvo-blue"
            data-pending={isPending ? "" : undefined}
          />
          <Label htmlFor="pkk-exclude-finance" className="cursor-pointer text-sm">
            Skjul finans og leasing
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="pkk-follow-up"
            type="checkbox"
            checked={onlyFollowUp === "1"}
            onChange={(event) =>
              setOnlyFollowUp(event.target.checked ? "1" : "0")
            }
            className="h-4 w-4 rounded border-border accent-volvo-blue"
            data-pending={isPending ? "" : undefined}
          />
          <Label htmlFor="pkk-follow-up" className="cursor-pointer text-sm">
            Kun kunder som trenger oppfølging
          </Label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {pkkHorizonDescription(horizon)}
        {" "}Storkunder grupperes på {pkkCustomerPartyLabel(party).toLowerCase()}.
        {excludeFinance === "1"
          ? " Finans, leasing og merkeimportører er skjult."
          : ""}
      </p>
    </div>
  );
}
