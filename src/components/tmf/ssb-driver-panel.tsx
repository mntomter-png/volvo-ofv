import {
  formatChangePct,
  formatSsbPeriod,
  formatSsbValue,
  type SsbDriverGroup,
} from "@/lib/ssb/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SsbDriverPanelProps {
  groups: SsbDriverGroup[];
}

export function SsbDriverPanel({ groups }: SsbDriverPanelProps) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SSB-drivere</CardTitle>
          <CardDescription>
            Ingen indikatorer er synket ennå. Kjør SSB-synk for å hente data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.driver}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
            <CardDescription>
              Etterspørselsdrivere fra SSB knyttet til {group.label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.indicators.map((indicator) => (
              <div
                key={indicator.indicator_key}
                className="rounded-lg border border-border/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{indicator.label}</p>
                    <p className="text-muted-foreground text-xs">
                      SSB {indicator.ssb_table_id} · {formatSsbPeriod(indicator.latestPeriod)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm tabular-nums">
                      {formatSsbValue(indicator.latestValue, indicator.unit)}
                    </p>
                    <p
                      className={
                        indicator.changePct != null && indicator.changePct > 0
                          ? "text-emerald-600 text-xs tabular-nums"
                          : indicator.changePct != null && indicator.changePct < 0
                            ? "text-red-600 text-xs tabular-nums"
                            : "text-muted-foreground text-xs tabular-nums"
                      }
                    >
                      {formatChangePct(indicator.changePct)} vs. forrige periode
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
