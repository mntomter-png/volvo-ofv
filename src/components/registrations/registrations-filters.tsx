"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { yearOptions } from "@/lib/registrations/filters";

const ALL_VALUE = "__all__";

interface NumberOption {
  value: number;
  label: string;
}

interface RegistrationsFiltersBarProps {
  segments: string[];
  makes: string[];
  regions: NumberOption[];
  hpBuckets: NumberOption[];
}

export function RegistrationsFiltersBar({
  segments,
  makes,
  regions,
  hpBuckets,
}: RegistrationsFiltersBarProps) {
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [segment, setSegment] = useQueryState("segment", nuqsOptions);
  const [make, setMake] = useQueryState("make", nuqsOptions);
  const [region, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [hp, setHp] = useQueryState("hp", parseAsInteger.withOptions(nuqsOptions));
  const [year, setYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()).withOptions(nuqsOptions),
  );
  const [, setPage] = useQueryState("page", parseAsInteger.withOptions(nuqsOptions));

  function resetPage() {
    setPage(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">År</span>
        <Select
          value={String(year)}
          onValueChange={(value) => {
            resetPage();
            setYear(Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger
            className="w-[100px]"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions().map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Segment</span>
        <Select
          value={segment ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setSegment(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger
            className="w-[200px]"
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
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Merke</span>
        <Select
          value={make ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setMake(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger
            className="w-[160px]"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue placeholder="Alle merker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle merker</SelectItem>
            {makes.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Region</span>
        <Select
          value={region != null ? String(region) : ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setRegion(value === ALL_VALUE ? null : Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger
            className="w-[240px]"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue placeholder="Hele landet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Hele landet</SelectItem>
            {regions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">HK</span>
        <Select
          value={hp != null ? String(hp) : ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setHp(value === ALL_VALUE ? null : Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger
            className="w-[150px]"
            data-pending={isPending ? "" : undefined}
          >
            <SelectValue placeholder="Alle HK" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle HK</SelectItem>
            {hpBuckets.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
