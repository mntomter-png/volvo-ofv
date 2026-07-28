import { formatNumber } from "@/lib/format";
import type { RegistrationRow } from "@/lib/registrations/queries";

interface RegistrationsTableProps {
  rows: RegistrationRow[];
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function RegistrationsTable({ rows }: RegistrationsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ingen nyregistreringer matcher filteret.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Dato</th>
            <th className="px-4 py-3 font-medium">Reg.nr</th>
            <th className="px-4 py-3 font-medium">Merke / modell</th>
            <th className="px-4 py-3 font-medium">Variant</th>
            <th className="px-4 py-3 font-medium">OFV Usage</th>
            <th className="px-4 py-3 text-right font-medium">Totalvekt</th>
            <th className="px-4 py-3 font-medium">Eier</th>
            <th className="px-4 py-3 font-medium">Eier postnr</th>
            <th className="px-4 py-3 font-medium">Eier poststed</th>
            <th className="px-4 py-3 font-medium">Bruker</th>
            <th className="px-4 py-3 font-medium">Bruker postnr</th>
            <th className="px-4 py-3 font-medium">Bruker poststed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.registration_number}-${row.transaction_time}`}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                {formatDateTime(row.transaction_time)}
              </td>
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
              <td className="px-4 py-2.5 max-w-[200px] truncate">
                {row.primary_owner_name ?? "–"}
              </td>
              <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-muted-foreground">
                {row.primary_owner_postal_code ?? "–"}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                {row.primary_owner_postal_district ?? "–"}
              </td>
              <td className="px-4 py-2.5 max-w-[200px] truncate">
                {row.primary_user_name ?? "–"}
              </td>
              <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-muted-foreground">
                {row.primary_user_postal_code ?? "–"}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                {row.primary_user_postal_district ?? "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
