"use client";

import { useTransition } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";

import { FleetRegionToolbar } from "@/components/registrations/fleet-region-toolbar";
import type { CentralFleetOrg } from "@/lib/fleet/central-orgs";
import type { FleetVinRegistryInfo } from "@/lib/fleet/registry";

export function FleetRegionControls({
  registry,
  canUpload,
  centralOrgs = [],
  centralOrgsError = null,
}: {
  registry: FleetVinRegistryInfo;
  canUpload: boolean;
  centralOrgs?: CentralFleetOrg[];
  centralOrgsError?: string | null;
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
        centralOrgs={centralOrgs}
        centralOrgsError={centralOrgsError}
      />
    </div>
  );
}
