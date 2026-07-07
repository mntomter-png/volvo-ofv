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
import { uploadFleetVins } from "@/lib/fleet/actions";
import {
  FLEET_FILTER_LABELS,
  type FleetFilter,
} from "@/lib/fleet";
import type { FleetVinRegistryInfo } from "@/lib/fleet/registry";
import { cn } from "@/lib/utils";

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fleetFilterActive = fleetFilter !== "all";
  const missingRegistry = fleetFilterActive && registry.vinCount === 0;

  function handleUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadFleetVins(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Lastet opp ${result.vinCount.toLocaleString("nb-NO")} fleet-VIN-er` +
          (result.skippedInvalid > 0
            ? ` (${result.skippedInvalid} ugyldige hoppet over)`
            : ""),
      );
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
            Skill sentralt fleetsalg (dealer 896) fra regionssalg i
            markedsandelstabellene. Filteret gjelder region- og distriktsvisning
            nedenfor ({FLEET_FILTER_LABELS[fleetFilter].toLowerCase()}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FleetFilterToggle
            value={fleetFilter}
            onChange={onFleetFilterChange}
            fleetVinCount={registry.vinCount}
          />
          {missingRegistry ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Fleet-filter er aktivt, men ingen VIN-er er lastet opp ennå.
              Markedsandel vises uten fleet-justering til registeret er fylt.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canUpload ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fleet-VIN-register</CardTitle>
            <CardDescription>
              Last opp en <strong>bearbeidet</strong> fil med kun VIN-er (anbefalt).
              Behold ChassisHierarchy internt — eksporter f.eks. kun VIN-kolonnen
              for dealer 896 før opplasting. Hele kildefilen lagres ikke; kun
              VIN-listen oppdateres i databasen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Anbefalt arbeidsflyt</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Filtrer ChassisHierarchy til dealer 896 internt.</li>
                <li>Eksporter kun VIN-kolonnen til Excel eller CSV.</li>
                <li>Last opp her — forrige register erstattes.</li>
              </ol>
              <p className="mt-2">
                Støtter også ChassisHierarchy med VIN + dealer number dersom filen
                allerede er filtrert.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fleet-vin-upload">VIN-fil (.xlsx / .xls / .csv)</Label>
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

            <p className="text-sm text-muted-foreground">
              {registry.vinCount > 0 ? (
                <>
                  <span className="font-medium text-foreground">
                    {registry.vinCount.toLocaleString("nb-NO")} VIN-er
                  </span>{" "}
                  i registeret
                  {registry.lastUploadedAt
                    ? ` · sist oppdatert ${formatDate(registry.lastUploadedAt)}`
                    : ""}
                  {registry.lastSourceLabel
                    ? ` (${registry.lastSourceLabel})`
                    : ""}
                </>
              ) : (
                "Ingen fleet-VIN-er lastet opp ennå."
              )}
            </p>

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
