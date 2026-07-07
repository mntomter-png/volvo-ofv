import { Badge } from "@/components/ui/badge";
import {
  buildSyncHealthDetail,
  formatSyncTimestamp,
  getOfvSyncHealth,
  syncHealthStatusLabel,
  type SyncHealthStatus,
} from "@/lib/sync/health";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  SyncHealthStatus,
  { badge: string; dot: string; variant: "secondary" | "destructive" | "outline" }
> = {
  ok: {
    variant: "outline",
    badge:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    dot: "bg-green-500",
  },
  warning: {
    variant: "outline",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  critical: {
    variant: "destructive",
    badge: "",
    dot: "bg-destructive-foreground",
  },
};

export async function SyncHealthBadge() {
  const health = await getOfvSyncHealth();
  if (!health) return null;

  const styles = statusStyles[health.status];
  const detail = buildSyncHealthDetail(health);

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <Badge
        variant={styles.variant}
        className={cn("gap-1.5 font-medium", styles.badge)}
        title={detail}
      >
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)}
          aria-hidden
        />
        {syncHealthStatusLabel(health.status)}
      </Badge>
      <p className="text-sm text-muted-foreground" title={detail}>
        {health.lastFullPublishDate
          ? `OFV-data per ${health.lastFullPublishDate}`
          : "OFV-data"}{" "}
        · synket {formatSyncTimestamp(health.lastAnySyncAt)}
        {health.lastFullDataVersion != null
          ? ` · v${health.lastFullDataVersion}`
          : ""}
      </p>
    </div>
  );
}
