import { formatNumber } from "@/lib/format";
import type { PopulationRow } from "@/lib/population/queries";

interface PopulationTableProps {
  rows: PopulationRow[];
}

function ownerUserCell(
  name: string | null,
  postalCode: string | null,
  district: string | null,
): string {
  if (!name) return "–";
  const location = [postalCode, district].filter(Boolean).join(" ");
  return location ? `${name} (${location})` : name;
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function PopulationTable({ rows }: PopulationTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ingen kjøretøy matcher filteret.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Reg.nr</th>
            <th className="px-4 py-3 font-medium">Merke / modell</th>
            <th className="px-4 py-3 font-medium">Variant</th>
            <th className="px-4 py-3 font-medium">OFV Usage</th>
            <th className="px-4 py-3 text-right font-medium">Totalvekt</th>
            <th className="px-4 py-3 font-medium">Først reg.</th>
            <th className="px-4 py-3 font-medium">Eier</th>
            <th className="px-4 py-3 font-medium">Bruker</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.registration_number}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                {row.registration_number}
              </td>
              <td className="px-4 py-2.5">
                <div>{row.make_name ?? "–"}</div>
                {row.model_name ? (
                  <div className="text-xs text-muted-foreground">{row.model_name}</div>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                {row.variant_name ?? "–"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {row.usage_name ?? "–"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                {row.maximum_laden_mass_kg
                  ? `${formatNumber(row.maximum_laden_mass_kg)} kg`
                  : "–"}
              </td>
              <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                {formatDate(row.first_registration_date)}
              </td>
              <td className="px-4 py-2.5 max-w-[220px] truncate">
                {ownerUserCell(
                  row.primary_owner_name,
                  row.primary_owner_postal_code,
                  row.primary_owner_postal_district,
                )}
              </td>
              <td className="px-4 py-2.5 max-w-[220px] truncate">
                {ownerUserCell(
                  row.primary_user_name,
                  row.primary_user_postal_code,
                  row.primary_user_postal_district,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
