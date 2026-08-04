import {
  INACTIVE_AFTER_DAYS,
  type UserUsageRow,
} from "@/lib/auth/usage-queries";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function pathLabel(path: string | null): string {
  if (!path) return "—";
  if (path === "/") return "Oversikt";
  return path;
}

export function UsageOverviewTable({ rows }: { rows: UserUsageRow[] }) {
  const inactiveCount = rows.filter((row) => row.inactive).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bruksstatistikk</CardTitle>
        <CardDescription>
          Siste sidebesøk per bruker (kun synlig for super). Data lagres i inntil
          90 dager og brukes til å følge opp inaktive kontoer (≥{" "}
          {INACTIVE_AFTER_DAYS} dager uten aktivitet).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pt-0">
        <p className="px-4 text-sm text-muted-foreground">
          {inactiveCount} av {rows.length} brukere er markert som inaktive.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">E-post</th>
                <th className="px-4 py-3 font-medium">Rolle</th>
                <th className="px-4 py-3 font-medium">Sist sett</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Siste side
                </th>
                <th className="px-4 py-3 font-medium">Besøk</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{row.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.roleLabel}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.lastSeenAt ? formatDateTime(row.lastSeenAt) : "Aldri"}
                    {row.daysSinceSeen != null ? (
                      <span className="mt-0.5 block text-xs">
                        {row.daysSinceSeen === 0
                          ? "I dag"
                          : `${row.daysSinceSeen} dager siden`}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {pathLabel(row.lastPath)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.visitCount}</td>
                  <td className="px-4 py-3">
                    {row.inactive ? (
                      <Badge variant="outline">Inaktiv</Badge>
                    ) : (
                      <Badge>Aktiv</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
