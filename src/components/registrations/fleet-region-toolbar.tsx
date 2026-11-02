"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FleetFilterToggle } from "@/components/fleet/fleet-filter-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { uploadFleetVins, type UploadFleetVinsResult } from "@/lib/fleet/actions";
import {
  FLEET_DEALER_INPUT_DEFAULT,
  FLEET_DEALER_LABEL,
  FLEET_FILTER_LABELS,
  fleetRegisterIsEmpty,
  type FleetFilter,
} from "@/lib/fleet";
import {
  FLEET_FILTER_DEFINITIONS,
  FLEET_FILTER_SCOPE_COPY,
} from "@/lib/registrations/fleet-share";
import type { FleetVinRegistryInfo } from "@/lib/fleet/registry";
import { cn } from "@/lib/utils";

function nb(value: number): string {
  return value.toLocaleString("nb-NO");
}

function uploadSummary(result: UploadFleetVinsResult): string {
  const parts: string[] = [];
  if (result.chassisCount > 0) {
    parts.push(
      `Lastet opp ${nb(result.chassisCount)} chassisnummer. ${nb(result.matchedCount)} treffer en registrering, ${nb(result.unregisteredCount)} er ikke registrert ennå.`,
    );
  }
  if (result.vinCount > 0) {
    parts.push(`Lastet opp ${nb(result.vinCount)} fleet-VIN-er.`);
  }
  if (result.skippedInvalid > 0) {
    parts.push(`${nb(result.skippedInvalid)} ugyldige rader hoppet over.`);
  }
  if (result.skippedDealer > 0) {
    parts.push(`${nb(result.skippedDealer)} rader utenfor forhandlerfilteret.`);
  }
  if (!result.dealerFilterApplied && result.chassisCount + result.vinCount > 0) {
    parts.push("Filen har ingen forhandlerkolonne, så alle rader er tatt med.");
  }
  return parts.join(" ");
}

function RegistryStatus({ registry }: { registry: FleetVinRegistryInfo }) {
  if (fleetRegisterIsEmpty(registry)) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen chassisnummer eller VIN-er er lastet opp ennå.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {registry.chassisCount > 0 ? (
        <p>
          <span className="font-medium text-foreground">
            {nb(registry.chassisCount)} chassisnummer
          </span>
          {". "}
          {nb(registry.matchedCount)} treffer en registrering,{" "}
          {nb(registry.unregisteredCount)} er ikke registrert ennå.
        </p>
      ) : null}
      {registry.vinCount > 0 ? (
        <p>
          <span className="font-medium text-foreground">
            {nb(registry.vinCount)} VIN-er
          </span>{" "}
          i registeret.
        </p>
      ) : null}
      {registry.lastUploadedAt || registry.lastSourceLabel ? (
        <p>
          {registry.lastUploadedAt
            ? `Sist oppdatert ${formatDate(registry.lastUploadedAt)}`
            : "Sist oppdatert"}
          {registry.lastSourceLabel ? ` (${registry.lastSourceLabel})` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function FleetRegionToolbar({
  fleetFilter,
  onFleetFilterChange,
  registry,
  canUpload,
  className,
}: {
  fleetFilter: FleetFilter;
  onFleetFilterChange: (value: FleetFilter) => void;
  registry: FleetVinRegistryInfo;
  canUpload: boolean;
  className?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dealers, setDealers] = useState(FLEET_DEALER_INPUT_DEFAULT);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fleetFilterActive = fleetFilter !== "all";
  const missingRegistry = fleetFilterActive && fleetRegisterIsEmpty(registry);

  function handleUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("dealers", dealers);

    startTransition(async () => {
      const result = await uploadFleetVins(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(uploadSummary(result));
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fleet Sales-filter</CardTitle>
          <CardDescription>
            Skiller Volvo Fleet Sales Norge ({FLEET_DEALER_LABEL}) fra
            regionssalg. {FLEET_FILTER_SCOPE_COPY} Nå:{" "}
            {FLEET_FILTER_LABELS[fleetFilter].toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FleetFilterToggle
            value={fleetFilter}
            onChange={onFleetFilterChange}
            fleetEntryCount={registry.vinCount + registry.chassisCount}
          />
          <p className="text-sm text-muted-foreground">
            {FLEET_FILTER_DEFINITIONS[fleetFilter]}
          </p>
          {missingRegistry ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Fleet-filter er aktivt, men ingen chassisnummer eller VIN-er er
              lastet opp ennå. Markedsandel vises uten fleet-justering til
              registeret er fylt.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canUpload ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fleet-register</CardTitle>
            <CardDescription>
              Last opp Volvos fleet-liste direkte. Filen kan ha chassisnummer
              (kolonnen T-Chassis) eller VIN. Hele filen lagres ikke. Forrige
              liste erstattes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Slik virker det</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Forhandlernummer {FLEET_DEALER_LABEL} er fylt inn. Endre
                  tallene, eller tøm feltet for å ta med alle rader.
                </li>
                <li>Last opp Excel eller CSV. Forrige liste erstattes.</li>
                <li>
                  Chassisnummer som ikke er registrert ennå blir med i
                  Fleet-filteret av seg selv når bilen registreres.
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fleet-dealer-filter">Forhandlernummer</Label>
              <Input
                id="fleet-dealer-filter"
                value={dealers}
                disabled={isPending}
                placeholder="896, 890"
                onChange={(event) => setDealers(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Brukes bare når filen har en forhandlerkolonne. Uten kolonnen
                tas alle rader med.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fleet-vin-upload">
                Fleet-fil (.xlsx / .xls / .csv)
              </Label>
              <Input
                id="fleet-vin-upload"
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={isPending}
                onChange={(event) =>
                  handleUpload(event.target.files?.[0] ?? null)
                }
              />
            </div>

            <RegistryStatus registry={registry} />

            {message ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
