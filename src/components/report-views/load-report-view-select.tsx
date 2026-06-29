"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsInteger } from "nuqs";
import { BookMarked } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPageUrl,
  describeReportViewConfig,
  isReportViewActive,
} from "@/lib/report-views/config";
import type { ReportViewRow } from "@/lib/report-views/queries";
import type { PageType } from "@/lib/supabase/types";

const NONE_VALUE = "__none__";

interface LoadReportViewSelectProps {
  pageType: PageType;
  views: ReportViewRow[];
}

export function LoadReportViewSelect({ pageType, views }: LoadReportViewSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [segment, setSegment] = useQueryState("segment", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });
  const [make, setMake] = useQueryState("make", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });
  const [year, setYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()).withOptions({
      shallow: false,
      clearOnDefault: true,
      startTransition,
    }),
  );
  const [, setMonth] = useQueryState("month", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });
  const [, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions({
      shallow: false,
      clearOnDefault: true,
      startTransition,
    }),
  );
  const [, setHp] = useQueryState(
    "hp",
    parseAsInteger.withOptions({
      shallow: false,
      clearOnDefault: true,
      startTransition,
    }),
  );

  const activeView = views.find((view) =>
    isReportViewActive(pageType, view.config, {
      segment,
      make,
      year,
    }),
  );

  if (views.length === 0) {
    return null;
  }

  function clearFilters() {
    if (pageType === "dashboard") {
      setSegment(null);
      return;
    }

    setSegment(null);
    setMake(null);

    if (pageType === "nyregistreringer") {
      setYear(null);
      setMonth(null);
      setRegion(null);
      setHp(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <BookMarked className="h-4 w-4 text-muted-foreground" />
      <Select
        value={activeView?.id ?? NONE_VALUE}
        onValueChange={(value) => {
          if (value === NONE_VALUE) {
            clearFilters();
            return;
          }

          const view = views.find((item) => item.id === value);
          if (!view) return;

          startTransition(() => {
            router.push(buildPageUrl(view.page_type, view.config));
          });
        }}
      >
        <SelectTrigger
          className="w-[220px]"
          data-pending={isPending ? "" : undefined}
        >
          <SelectValue placeholder="Lagrede visninger" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Ingen lagret visning</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.name}
              <span className="sr-only">
                {" "}
                – {describeReportViewConfig(view.page_type, view.config)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
