"use client";

import { useTransition } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";

import { FleetRegionToolbar } from "@/components/registrations/fleet-region-toolbar";
import type { FleetVinRegistryInfo } from "@/lib/fleet/registry";

export function FleetRegionControls({
  registry,
  canUpload,
}: {
  registry: FleetVinRegistryInfo;
  canUpload: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [fleet, setFleet] = useQueryState(
    "fleet",
    parseAsStringLiteral(["all", "region", "fleet"] as const)
      .withDefault("all")
      .withOptions({
        shallow: false,
        clearOnDefault: true,
        startTransition,
      }),
  );

  return (
    <div data-pending={isPending ? "" : undefined}>
      <FleetRegionToolbar
        fleetFilter={fleet}
        onFleetFilterChange={setFleet}
        registry={registry}
        canUpload={canUpload}
      />
    </div>
  );
}
