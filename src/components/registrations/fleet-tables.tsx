import { formatNumber, formatPercent } from "@/lib/format";
import type { FleetAnalysis } from "@/lib/registrations/queries";

function volvoShare(volvo: number, total: number): number {
  return total > 0 ? (volvo / total) * 100 : 0;
}

export function FleetTables({ fleet }: { fleet: FleetAnalysis }) {
  if (fleet.ownerCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen flåte-eiere i utvalget (finans/leasing/importør er utelatt).
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-x-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          Antall eiere og kjøretøy per flåtestørrelse (kjøp i perioden).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Flåtestørrelse</th>
              <th className="pb-2 text-right font-medium">Eiere</th>
              <th className="pb-2 text-right font-medium">Kjøretøy</th>
              <th className="pb-2 text-right font-medium">Volvo</th>
              <th className="pb-2 text-right font-medium">Volvo-andel</th>
            </tr>
          </thead>
          <tbody>
            {fleet.bands.map((band) => (
              <tr key={band.label} className="border-b last:border-0">
                <td className="py-2">{band.label}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(band.owners)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(band.count)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(band.volvo_count)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-volvo-blue">
                  {formatPercent(volvoShare(band.volvo_count, band.count))} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          Største kjøpere i perioden (topp {fleet.topOwners.length}).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Eier</th>
              <th className="pb-2 text-right font-medium">Kjøretøy</th>
              <th className="pb-2 text-right font-medium">Volvo</th>
              <th className="pb-2 text-right font-medium">Volvo-andel</th>
            </tr>
          </thead>
          <tbody>
            {fleet.topOwners.map((owner) => (
              <tr key={owner.name} className="border-b last:border-0">
                <td className="max-w-[220px] truncate py-2" title={owner.name}>
                  {owner.name}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(owner.count)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(owner.volvo_count)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-volvo-blue">
                  {formatPercent(volvoShare(owner.volvo_count, owner.count))} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
