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

const ALL_VALUE = "__all__";

interface PopulationFiltersBarProps {
  segments: string[];
  makes: string[];
}

export function PopulationFiltersBar({
  segments,
  makes,
}: PopulationFiltersBarProps) {
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [segment, setSegment] = useQueryState("segment", nuqsOptions);
  const [make, setMake] = useQueryState("make", nuqsOptions);
  const [, setPage] = useQueryState("page", parseAsInteger.withOptions(nuqsOptions));

  function resetPage() {
    setPage(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );
}
