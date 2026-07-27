import {
  formatAuditAction,
  formatAuditDetails,
  type AdminAuditLogRow,
} from "@/lib/auth/audit-queries";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuditLogTable({ entries }: { entries: AdminAuditLogRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitetslogg</CardTitle>
        <CardDescription>
          De siste admin-handlingene i systemet (maks 50).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Ingen hendelser er logget ennå.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tidspunkt</th>
                  <th className="px-4 py-3 font-medium">Utført av</th>
                  <th className="px-4 py-3 font-medium">Handling</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Detaljer
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const details = formatAuditDetails(
                    entry.action,
                    entry.metadata,
                  );

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.actorEmail ?? "Ukjent"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatAuditAction(entry.action)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {details || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
