"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import { Label } from "@/components/ui/label";

/** Skjul finans, importører og forhandlere på toppkjøperlisten. Default på. */
export function BuyerChannelFilter() {
  const [isPending, startTransition] = useTransition();
  const [excludeChannel, setExcludeChannel] = useQueryState("excludeChannel", {
    defaultValue: "1",
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  return (
    <div
      className="flex items-center gap-2"
      data-pending={isPending ? "" : undefined}
    >
      <input
        id="kjopere-exclude-channel"
        type="checkbox"
        checked={excludeChannel !== "0"}
        onChange={(event) =>
          setExcludeChannel(event.target.checked ? "1" : "0")
        }
        className="h-4 w-4 rounded border-border accent-volvo-blue"
      />
      <Label htmlFor="kjopere-exclude-channel" className="cursor-pointer text-sm">
        Skjul finans, importører og forhandlere
      </Label>
    </div>
  );
}
