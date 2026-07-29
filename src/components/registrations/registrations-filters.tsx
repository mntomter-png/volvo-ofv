"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";

import {
  FilterBar,
  FilterField,
  MoreFiltersToggle,
  PrimaryFilterRow,
} from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { yearOptions } from "@/lib/registrations/filters";

const ALL_VALUE = "__all__";

interface NumberOption {
  value: number;
  label: string;
}

interface StringOption {
  value: string;
  label: string;
}

interface BodyworkOption {
  value: number;
  label: string;
  segment: string;
}

interface RegistrationsFiltersBarProps {
  makes: string[];
  regions: NumberOption[];
  hpBuckets: NumberOption[];
  fuels: string[];
  pabyggOptions: StringOption[];
  bodyworkOptions: BodyworkOption[];
  dispOptions: NumberOption[];
}

export function RegistrationsFiltersBar({
  makes,
  regions,
  hpBuckets,
  fuels,
  pabyggOptions,
  bodyworkOptions,
  dispOptions,
}: RegistrationsFiltersBarProps) {
  const [isPending, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };

  const [make, setMake] = useQueryState("make", nuqsOptions);
  const [region, setRegion] = useQueryState(
    "region",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [hp, setHp] = useQueryState("hp", parseAsInteger.withOptions(nuqsOptions));
  const [fuel, setFuel] = useQueryState("fuel", nuqsOptions);
  const [pabygg, setPabygg] = useQueryState("pabygg", nuqsOptions);
  const [bodywork, setBodywork] = useQueryState(
    "bodywork",
    parseAsInteger.withOptions(nuqsOptions),
  );
  const [disp, setDisp] = useQueryState("disp", parseAsInteger.withOptions(nuqsOptions));
  /** Chassis skjult i UI – rydd bort gamle URL-verdier så de ikke filtrerer usynlig. */
  const [, setChassis] = useQueryState("chassis", nuqsOptions);
  const [year, setYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()).withOptions(nuqsOptions),
  );
  const [from, setFrom] = useQueryState("from", nuqsOptions);
  const [to, setTo] = useQueryState("to", nuqsOptions);
  const [, setPage] = useQueryState("page", parseAsInteger.withOptions(nuqsOptions));

  function resetPage() {
    setPage(null);
  }

  const dateInterval = from != null || to != null;

  const filteredBodyworkOptions = useMemo(() => {
    if (!pabygg) return bodyworkOptions;
    return bodyworkOptions.filter((option) => option.segment === pabygg);
  }, [bodyworkOptions, pabygg]);

  const advancedActiveCount = [bodywork, hp, fuel, disp].filter(
    (value) => value != null,
  ).length;

  const [advancedOpen, setAdvancedOpen] = useState(advancedActiveCount > 0);

  useEffect(() => {
    void setChassis(null);
  }, [setChassis]);

  useEffect(() => {
    if (advancedActiveCount > 0) {
      setAdvancedOpen(true);
    }
  }, [advancedActiveCount]);

  return (
    <div className="flex flex-col gap-3">
      <PrimaryFilterRow>
        <FilterField label="År" className="lg:w-[7.5rem]">
          <Select
            value={String(year)}
            disabled={dateInterval}
            onValueChange={(value) => {
              resetPage();
              setYear(Number.parseInt(value, 10));
            }}
          >
            <SelectTrigger
              className="w-full"
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
        </FilterField>

        <FilterField label="Periode" className="lg:min-w-[20rem] lg:flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Input
              type="date"
              value={from ?? ""}
              max={to ?? undefined}
              aria-label="Fra dato"
              className="min-w-0 flex-1 basis-[9rem]"
              data-pending={isPending ? "" : undefined}
              onChange={(event) => {
                resetPage();
                setFrom(event.target.value === "" ? null : event.target.value);
              }}
            />
            <span className="text-sm text-muted-foreground">–</span>
            <Input
              type="date"
              value={to ?? ""}
              min={from ?? undefined}
              aria-label="Til dato"
              className="min-w-0 flex-1 basis-[9rem]"
              data-pending={isPending ? "" : undefined}
              onChange={(event) => {
                resetPage();
                setTo(event.target.value === "" ? null : event.target.value);
              }}
            />
            {dateInterval ? (
              <button
                type="button"
                className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  resetPage();
                  setFrom(null);
                  setTo(null);
                }}
              >
                Nullstill
              </button>
            ) : null}
          </div>
        </FilterField>

        <FilterField label="Merke" className="lg:w-[12rem]">
          <Select
            value={make ?? ALL_VALUE}
            onValueChange={(value) => {
              resetPage();
              setMake(value === ALL_VALUE ? null : value);
            }}
          >
            <SelectTrigger
              className="w-full"
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
        </FilterField>

        <FilterField label="Påbygg" className="lg:w-[12rem]">
          <Select
            value={pabygg ?? ALL_VALUE}
            onValueChange={(value) => {
              resetPage();
              const next = value === ALL_VALUE ? null : value;
              setPabygg(next);
              if (
                next &&
                bodywork != null &&
                !bodyworkOptions.some(
                  (option) =>
                    option.value === bodywork && option.segment === next,
                )
              ) {
                setBodywork(null);
              }
            }}
          >
            <SelectTrigger
              className="w-full"
              data-pending={isPending ? "" : undefined}
            >
              <SelectValue placeholder="Alle påbygg" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Alle påbygg</SelectItem>
              {pabyggOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {regions.length > 0 ? (
          <FilterField label="Region" className="lg:min-w-[14rem] lg:flex-1">
            <Select
              value={region != null ? String(region) : ALL_VALUE}
              onValueChange={(value) => {
                resetPage();
                setRegion(
                  value === ALL_VALUE ? null : Number.parseInt(value, 10),
                );
              }}
            >
              <SelectTrigger
                className="w-full"
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
          </FilterField>
        ) : null}
      </PrimaryFilterRow>

      <MoreFiltersToggle
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((value) => !value)}
        activeCount={advancedActiveCount}
      />

      {advancedOpen ? (
        <FilterBar className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <FilterField label="Påbygg-kode">
            <Select
              value={bodywork != null ? String(bodywork) : ALL_VALUE}
              onValueChange={(value) => {
                resetPage();
                setBodywork(
                  value === ALL_VALUE ? null : Number.parseInt(value, 10),
                );
              }}
            >
              <SelectTrigger
                className="w-full"
                data-pending={isPending ? "" : undefined}
              >
                <SelectValue placeholder="Alle koder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Alle koder</SelectItem>
                {filteredBodyworkOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="HK">
            <Select
              value={hp != null ? String(hp) : ALL_VALUE}
              onValueChange={(value) => {
                resetPage();
                setHp(value === ALL_VALUE ? null : Number.parseInt(value, 10));
              }}
            >
              <SelectTrigger
                className="w-full"
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
          </FilterField>

          <FilterField label="Drivstoff">
            <Select
              value={fuel ?? ALL_VALUE}
              onValueChange={(value) => {
                resetPage();
                setFuel(value === ALL_VALUE ? null : value);
              }}
            >
              <SelectTrigger
                className="w-full"
                data-pending={isPending ? "" : undefined}
              >
                <SelectValue placeholder="Alle drivstoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Alle drivstoff</SelectItem>
                {fuels.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Slagvolum">
            <Select
              value={disp != null ? String(disp) : ALL_VALUE}
              onValueChange={(value) => {
                resetPage();
                setDisp(
                  value === ALL_VALUE ? null : Number.parseInt(value, 10),
                );
              }}
            >
              <SelectTrigger
                className="w-full"
                data-pending={isPending ? "" : undefined}
              >
                <SelectValue placeholder="Alle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Alle</SelectItem>
                {dispOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      ) : null}
    </div>
  );
}
