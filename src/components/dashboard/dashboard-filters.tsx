"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import { useBrand } from "@/components/brand/brand-provider";
import { FilterBar, FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PABYGG_FILTER_OPTIONS, REGION_FILTER_OPTIONS } from "@/lib/ofv/segmentation";

const ALL_VALUE = "__all__";

interface DashboardFiltersProps {
  segments: string[];
}

export function DashboardFilters({ segments }: DashboardFiltersProps) {
  const brand = useBrand();
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [segment, setSegment] = useQueryState("segment", nuqsOptions);
  const [region, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [pabygg, setPabygg] = useQueryState("pabygg", nuqsOptions);

  return (
    <FilterBar>
      <FilterField label="OFV-segment">
        <Select
          value={segment ?? ALL_VALUE}
          onValueChange={(value) =>
            setSegment(value === ALL_VALUE ? null : value)
          }
        >
          <SelectTrigger
            className="w-full"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue placeholder="Alle segmenter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle segmenter</SelectItem>
            {segments.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {brand.showDealerRegions ? (
        <FilterField label="Region">
          <Select
            value={region != null ? String(region) : ALL_VALUE}
            onValueChange={(value) =>
              setRegion(value === ALL_VALUE ? null : Number.parseInt(value, 10))
            }
          >
            <SelectTrigger
              className="w-full"
              data-pending={isPending ? "" : undefined}
            >
              <SelectValue placeholder="Hele landet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Hele landet</SelectItem>
              {REGION_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      ) : null}

      <FilterField label="Påbygg">
        <Select
          value={pabygg ?? ALL_VALUE}
          onValueChange={(value) =>
            setPabygg(value === ALL_VALUE ? null : value)
          }
        >
          <SelectTrigger
            className="w-full"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue placeholder="Alle påbygg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle påbygg</SelectItem>
            {PABYGG_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </FilterBar>
  );
}
