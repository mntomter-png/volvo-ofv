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

interface NumberOption {
  value: number;
  label: string;
}

interface StringOption {
  value: string;
  label: string;
}

interface PopulationFiltersBarProps {
  segments: string[];
  makes: string[];
  regions: NumberOption[];
  hpBuckets: NumberOption[];
  fuels: string[];
  pabyggOptions: StringOption[];
  dispOptions: NumberOption[];
  chassisOptions: StringOption[];
  ageOptions: StringOption[];
}

export function PopulationFiltersBar({
  segments,
  makes,
  regions,
  hpBuckets,
  fuels,
  pabyggOptions,
  dispOptions,
  chassisOptions,
  ageOptions,
}: PopulationFiltersBarProps) {
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
  const [fuel, setFuel] = useQueryState("fuel", nuqsOptions);
  const [pabygg, setPabygg] = useQueryState("pabygg", nuqsOptions);
  const [disp, setDisp] = useQueryState("disp", parseAsInteger.withOptions(nuqsOptions));
  const [chassis, setChassis] = useQueryState("chassis", nuqsOptions);
  const [age, setAge] = useQueryState("age", nuqsOptions);
  const [, setPage] = useQueryState("page", parseAsInteger.withOptions(nuqsOptions));

  function resetPage() {
    setPage(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">OFV-segment</span>
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

      {regions.length > 0 ? (
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
      ) : null}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">HK</span>
        <Select
          value={hp != null ? String(hp) : ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setHp(value === ALL_VALUE ? null : Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger className="w-[150px]" data-pending={isPending ? "" : undefined}>
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

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Drivstoff</span>
        <Select
          value={fuel ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setFuel(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger className="w-[160px]" data-pending={isPending ? "" : undefined}>
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
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Påbygg</span>
        <Select
          value={pabygg ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setPabygg(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger className="w-[160px]" data-pending={isPending ? "" : undefined}>
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
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Slagvolum</span>
        <Select
          value={disp != null ? String(disp) : ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setDisp(value === ALL_VALUE ? null : Number.parseInt(value, 10));
          }}
        >
          <SelectTrigger className="w-[130px]" data-pending={isPending ? "" : undefined}>
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
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Chassis</span>
        <Select
          value={chassis ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setChassis(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger className="w-[130px]" data-pending={isPending ? "" : undefined}>
            <SelectValue placeholder="Alle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle</SelectItem>
            {chassisOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Alder</span>
        <Select
          value={age ?? ALL_VALUE}
          onValueChange={(value) => {
            resetPage();
            setAge(value === ALL_VALUE ? null : value);
          }}
        >
          <SelectTrigger className="w-[180px]" data-pending={isPending ? "" : undefined}>
            <SelectValue placeholder="Alle aldre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle aldre</SelectItem>
            {ageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
