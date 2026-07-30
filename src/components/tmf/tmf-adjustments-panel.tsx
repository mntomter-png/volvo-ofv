"use client";

import { useState, useTransition } from "react";
import { useQueryState } from "nuqs";

import { MoreFiltersToggle } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import {
  ALL_PABYGG_SEGMENTS,
  getPabyggSegmentLabel,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";
import {
  parseTmfJsonParam,
  serializeTmfJsonParam,
} from "@/lib/tmf/adjustments";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function readRecord(raw: string): Record<string, number> {
  return parseTmfJsonParam(raw || undefined);
}

export function TmfAdjustmentsPanel() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [adjRaw, setAdjRaw] = useQueryState("adj", {
    defaultValue: "",
    shallow: false,
    startTransition,
  });
  const [volvoRaw, setVolvoRaw] = useQueryState("volvo", {
    defaultValue: "",
    shallow: false,
    startTransition,
  });

  const adjustments = readRecord(adjRaw ?? "");
  const volvoOverrides = readRecord(volvoRaw ?? "");
  const activeCount =
    Object.keys(adjustments).length + Object.keys(volvoOverrides).length;

  function updateAdjustment(segment: PabyggSegment, value: string) {
    const parsed = value === "" ? undefined : Number.parseFloat(value);
    const next = { ...adjustments };
    if (parsed == null || !Number.isFinite(parsed) || parsed === 0) {
      delete next[segment];
    } else {
      next[segment] = Math.max(-50, Math.min(50, parsed));
    }
    void setAdjRaw(serializeTmfJsonParam(next) || null);
  }

  function updateVolvoShare(segment: PabyggSegment, value: string) {
    const parsed = value === "" ? undefined : Number.parseFloat(value);
    const next = { ...volvoOverrides };
    if (parsed == null || !Number.isFinite(parsed)) {
      delete next[segment];
    } else {
      next[segment] = Math.max(0, Math.min(100, parsed));
    }
    void setVolvoRaw(serializeTmfJsonParam(next) || null);
  }

  return (
    <div className="space-y-3">
      <MoreFiltersToggle
        open={open}
        onToggle={() => setOpen((value) => !value)}
        activeCount={activeCount}
        closedLabel="Analytikerjustering"
        openLabel="Skjul analytikerjustering"
      />

      {open ? (
        <Card>
          <CardHeader>
            <CardTitle>Analytikerjustering</CardTitle>
            <CardDescription>
              Valgfritt. Overstyr prognosen per segment. Justering i % legges på toppen av
              SSB/scenario. Volvo-andel kan overstyres for neste års estimat.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Segment</th>
                  <th className="pb-3 pr-4 font-medium">Justering (%)</th>
                  <th className="pb-3 font-medium">Volvo-andel neste år (%)</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PABYGG_SEGMENTS.map((segment) => (
                  <tr key={segment} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">
                      {getPabyggSegmentLabel(segment)}
                    </td>
                    <td className="py-3 pr-4">
                      <Input
                        type="number"
                        min={-50}
                        max={50}
                        step={0.5}
                        className="h-9 w-28"
                        disabled={isPending}
                        placeholder="0"
                        value={adjustments[segment] ?? ""}
                        onChange={(event) =>
                          updateAdjustment(segment, event.target.value)
                        }
                      />
                    </td>
                    <td className="py-3">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        className="h-9 w-28"
                        disabled={isPending}
                        placeholder="Auto"
                        value={volvoOverrides[segment] ?? ""}
                        onChange={(event) =>
                          updateVolvoShare(segment, event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-muted-foreground text-xs">
              Tomt Volvo-felt bruker rullerende 12-mnd markedsandel fra OFV.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
