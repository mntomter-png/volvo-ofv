import { formatDate, formatNumber } from "@/lib/format";
import type { PkkDueVehicleRow } from "@/lib/pkk/queries";

function formatPkkDate(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso);
}

function formatDaysUntil(days: number | null): string {
  if (days == null) return "—";
  if (days < 0) return `${formatNumber(Math.abs(days))} d. forfalt`;
  if (days === 0) return "I dag";
  return `${formatNumber(days)} d.`;
}

function daysClass(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "font-medium text-destructive";
  if (days <= 30) return "font-medium text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function PkkDueVehiclesTable({
  rows,
  shortName,
}: {
  rows: PkkDueVehicleRow[];
  shortName: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen {shortName}-kjøretøy med PKK-frist innen 6 måneder blant de største
        kundene i utvalget.
      </p>
    );
  }

  return (
    <div className="max-h-[min(70vh,36rem)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Eier</th>
            <th className="py-2 pr-3 font-medium">Reg.nr.</th>
            <th className="py-2 pr-3 font-medium">Modell</th>
            <th className="py-2 pr-3 font-medium">1. reg.</th>
            <th className="py-2 pr-3 font-medium">Siste PKK</th>
            <th className="py-2 pr-3 font-medium">Neste frist</th>
            <th className="py-2 font-medium text-right">Til frist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.owner_key}-${row.registration_number}`}
              className="border-b border-border/60"
            >
              <td className="max-w-[12rem] truncate py-2 pr-3 font-medium">
                {row.owner_name}
              </td>
              <td className="py-2 pr-3 tabular-nums">{row.registration_number}</td>
              <td className="py-2 pr-3">{row.model_name ?? "—"}</td>
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {formatPkkDate(row.first_registration_date)}
              </td>
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {formatPkkDate(row.pkk_last_date)}
              </td>
              <td className="py-2 pr-3 tabular-nums">{formatPkkDate(row.pkk_next_deadline)}</td>
              <td className={`py-2 text-right tabular-nums ${daysClass(row.days_until_due)}`}>
                {formatDaysUntil(row.days_until_due)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
