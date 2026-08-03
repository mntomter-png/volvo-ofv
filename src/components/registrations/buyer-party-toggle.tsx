"use client";

import { useQueryState } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOMER_PARTY_OPTIONS,
  type CustomerParty,
} from "@/lib/ofv/customer-party";

/** URL-toggle for eier vs bruker på Kjøpere / Region. Default: bruker. */
export function BuyerPartyToggle() {
  const [party, setParty] = useQueryState("party", {
    defaultValue: "user",
    clearOnDefault: true,
    shallow: false,
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Kunde</span>
      <Select
        value={party === "owner" ? "owner" : "user"}
        onValueChange={(value) => {
          void setParty(value as CustomerParty);
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CUSTOMER_PARTY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
