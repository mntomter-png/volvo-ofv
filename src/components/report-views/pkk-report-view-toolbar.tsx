"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useQueryState,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs";
import { BookMarked } from "lucide-react";

import { SaveReportViewDialog } from "@/components/report-views/save-report-view-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PkkFilters, PkkMinFleet } from "@/lib/pkk/filters";
import { POPULATION_DISTRICTS } from "@/lib/ofv/segmentation";
import {
  buildPkkConfig,
  buildPageUrl,
  describeReportViewConfig,
  isReportViewActive,
} from "@/lib/report-views/config";
import type { ReportViewRow } from "@/lib/report-views/queries";

const NONE_VALUE = "__none__";

function usePkkFiltersFromUrl(): PkkFilters {
  const [region] = useQueryState("region", parseAsInteger);
  const [district] = useQueryState("district");
  const [minFleetRaw] = useQueryState("minFleet", parseAsInteger);
  const [horizon] = useQueryState(
    "horizon",
    parseAsStringLiteral(["actionable", "upcoming", "all"] as const).withDefault(
      "actionable",
    ),
  );
  const [followUp] = useQueryState(
    "followUp",
    parseAsStringLiteral(["0", "1"] as const).withDefault("1"),
  );
  const [excludeFinance] = useQueryState(
    "excludeFinance",
    parseAsStringLiteral(["0", "1"] as const).withDefault("1"),
  );
  const [party] = useQueryState(
    "party",
    parseAsStringLiteral(["owner", "user"] as const).withDefault("owner"),
  );
  const [customerSearch] = useQueryState("q");

  const minFleet = (minFleetRaw ?? 5) as PkkMinFleet;

  return useMemo(
    () => ({
      region: region ?? null,
      district:
        district?.trim() && POPULATION_DISTRICTS.has(district.trim())
          ? district.trim()
          : null,
      minFleet,
      onlyFollowUp: followUp === "1",
      horizon: horizon ?? "actionable",
      excludeFinance: excludeFinance === "1",
      customerParty: party ?? "owner",
      customerSearch: customerSearch?.trim() ? customerSearch.trim() : null,
    }),
    [
      region,
      district,
      minFleet,
      followUp,
      horizon,
      excludeFinance,
      party,
      customerSearch,
    ],
  );
}

export function PkkSaveReportViewButton() {
  const filters = usePkkFiltersFromUrl();
  const config = buildPkkConfig(filters);
  const filterSummary = describeReportViewConfig("pkk", config);

  return (
    <SaveReportViewDialog
      pageType="pkk"
      config={config}
      filterSummary={filterSummary}
      description="Lagrer gjeldende PKK-filter og kundesøk slik at du kan hente visningen fram igjen senere."
    />
  );
}

export function PkkReportViewToolbar({ views }: { views: ReportViewRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const filters = usePkkFiltersFromUrl();

  const activeView = views.find((view) =>
    isReportViewActive("pkk", view.config, { pkk: filters }),
  );

  if (views.length === 0) {
    return <PkkSaveReportViewButton />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BookMarked className="h-4 w-4 text-muted-foreground" />
      <Select
        value={activeView?.id ?? NONE_VALUE}
        onValueChange={(value) => {
          if (value === NONE_VALUE) {
            startTransition(() => {
              router.push("/pkk");
            });
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
      <PkkSaveReportViewButton />
    </div>
  );
}
