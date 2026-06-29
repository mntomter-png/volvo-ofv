"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

interface SegmentFilterProps {
  segments: string[];
}

export function SegmentFilter({ segments }: SegmentFilterProps) {
  const [isPending, startTransition] = useTransition();
  const [segment, setSegment] = useQueryState("segment", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Segment</span>
      <Select
        value={segment ?? ALL_VALUE}
        onValueChange={(value) =>
          setSegment(value === ALL_VALUE ? null : value)
        }
      >
        <SelectTrigger
          className="w-[220px]"
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
  );
}
