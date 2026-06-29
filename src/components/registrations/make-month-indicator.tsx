"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function MakeMonthIndicator({ monthLabel }: { monthLabel: string }) {
  const [, startTransition] = useTransition();
  const [, setMonth] = useQueryState("month", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });

  return (
    <button
      type="button"
      onClick={() => setMonth(null)}
      className="inline-flex items-center"
      title="Vis hele året"
    >
      <Badge
        variant="accent"
        className="cursor-pointer gap-1 hover:opacity-90"
      >
        {monthLabel}
        <X className="h-3 w-3" />
      </Badge>
    </button>
  );
}
