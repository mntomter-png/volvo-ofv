import type { PkkCustomerRow } from "@/lib/pkk/queries";

export type PkkPriority = "critical" | "urgent" | "plan" | "inform" | "ok";

export function getPkkPriority(customer: PkkCustomerRow): PkkPriority {
  if (customer.overdue_count > 0) return "critical";
  if (customer.due_30_count > 0) return "urgent";
  if (customer.due_90_count > 0) return "plan";
  if (customer.due_180_count > 0) return "inform";
  return "ok";
}

export function customerNeedsFollowUp(customer: PkkCustomerRow): boolean {
  return (
    customer.overdue_count > 0 ||
    customer.due_30_count > 0 ||
    customer.due_90_count > 0
  );
}

export const PKK_PRIORITY_LABELS: Record<PkkPriority, string> = {
  critical: "Kritisk",
  urgent: "Haster",
  plan: "Planlegg",
  inform: "Informér",
  ok: "OK",
};

export const PKK_PRIORITY_CLASSES: Record<PkkPriority, string> = {
  critical:
    "border-destructive/30 bg-destructive/10 text-destructive",
  urgent:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  plan:
    "border-volvo-blue/20 bg-volvo-blue/8 text-volvo-blue",
  inform:
    "border-border bg-muted/60 text-muted-foreground",
  ok: "border-border bg-muted/40 text-muted-foreground",
};
