import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  annualDrivetrainVolumes,
  drivetrainShares,
  partitionDrivetrainCounts,
} from "@/lib/tmf/drivetrain";
import { buildTmfEstimate } from "@/lib/tmf/model";
import { buildTmfNarrative } from "@/lib/tmf/narrative";
import type { TmfMonthlyMarketRow } from "@/lib/tmf/types";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20261031195512_tmf_drivetrain_diesel_gas_other.sql",
);

/**
 * Tolv flate måneder, okt 2025–sep 2026, så trailing-vinduet ved 31. okt 2026
 * er hele serien. 8 = 2 el + 4 diesel + 1 gass + 1 annet (hydrogen).
 * Andelene er binært eksakte (0.25 / 0.5 / 0.125).
 */
function marketRows(): TmfMonthlyMarketRow[] {
  const rows: TmfMonthlyMarketRow[] = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(Date.UTC(2025, 9 + i, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
    rows.push({
      month,
      pabygg: "Annet",
      count: 8,
      volvo_count: 2,
      emob_count: 2,
      diesel_count: 4,
      gas_count: 1,
      other_count: 1,
    });
  }
  return rows;
}

describe("partitionDrivetrainCounts", () => {
  it("holder hydrogen i annet og lar den ikke øke diesel", () => {
    const counts = partitionDrivetrainCounts([
      {
        count: 100,
        emob_count: 15,
        diesel_count: 70,
        gas_count: 12,
        other_count: 3,
      },
    ]);

    assert.equal(counts.diesel, 70);
    assert.equal(counts.gas, 12);
    assert.equal(counts.other, 3);
    assert.equal(counts.emob + counts.diesel + counts.gas + counts.other, 100);

    const shares = drivetrainShares(counts);
    assert.equal(shares.dieselSharePct, 70);
    assert.notEqual(shares.dieselSharePct, 73);
  });

  it("legger ufordelt rest i annet, ikke i diesel", () => {
    const counts = partitionDrivetrainCounts([{ count: 8, emob_count: 2 }]);
    assert.equal(counts.diesel, 0);
    assert.equal(counts.gas, 0);
    assert.equal(counts.other, 6);
  });
});

describe("annualDrivetrainVolumes", () => {
  it("splitter årsvolumet uten å endre totalen", () => {
    const volumes = annualDrivetrainVolumes(96, {
      emobSharePct: 25,
      dieselSharePct: 50,
      gasSharePct: 12.5,
      otherSharePct: 12.5,
    });

    assert.equal(volumes.annualEmob, 24);
    assert.equal(volumes.annualDiesel, 48);
    assert.equal(volumes.annualGas, 12);
    assert.equal(volumes.annualOther, 12);
    assert.equal(volumes.annualIce, 72);
    assert.equal(
      volumes.annualEmob + volumes.annualDiesel + volumes.annualGas + volumes.annualOther,
      96,
    );
  });
});

describe("TMF-prognose med diesel, gass og annet", () => {
  const reference = new Date(2026, 9, 31, 12, 0, 0);
  const estimate = buildTmfEstimate(
    marketRows(),
    [],
    { scenarioId: "basis", segmentAdjustments: {}, volvoShareOverrides: {} },
    reference,
  );

  it("bruker trailing-andelen på neste år, med hydrogen i annet", () => {
    const next = estimate.nextYear;
    assert.equal(next.year, 2027);
    assert.equal(next.total.annualMarket, 96);
    assert.equal(next.total.annualEmob, 24);
    assert.equal(next.total.annualDiesel, 48);
    assert.equal(next.total.annualGas, 12);
    assert.equal(next.total.annualOther, 12);
    assert.equal(next.total.annualIce, 72);
    assert.equal(next.total.dieselSharePct, 50);
    assert.equal(next.total.gasSharePct, 12.5);
    assert.equal(next.total.otherSharePct, 12.5);

    const segment = next.segments.find((row) => row.pabygg === "Annet");
    assert.ok(segment);
    assert.equal(segment.annualDiesel, 48);
    assert.equal(segment.annualOther, 12);
    assert.ok(segment.annualDiesel < segment.annualMarket - segment.annualEmob);
  });

  it("splitter inneværende årsprognose på samme måte", () => {
    const current = estimate.currentYear;
    assert.equal(current.total.annualAdjustedForecast, 96);
    assert.equal(current.total.annualDiesel, 48);
    assert.equal(current.total.annualGas, 12);
    assert.equal(current.total.annualOther, 12);
    assert.equal(current.segments[0]?.annualGas, 12);
  });

  it("nevner diesel, gass og annet i narrativet", () => {
    const narrative = buildTmfNarrative(estimate);
    assert.match(narrative.lead, /diesel/);
    assert.match(narrative.lead, /gass/);
    assert.match(narrative.lead, /annet/);
    assert.match(narrative.lead, /hydrogen/);
    assert.doesNotMatch(narrative.lead, /\bICE\b/);
    assert.equal(
      narrative.caveats.some((line) => /hydrogen/.test(line) && /diesel/.test(line)),
      true,
    );
    assert.equal(
      narrative.caveats.some((line) => /\bICE\b/.test(line)),
      false,
    );
  });
});

describe("tmf_monthly_market-migrasjonen", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const lower = sql.toLowerCase();

  it("dropper funksjonen fordi returtypen endres, og beholder security invoker", () => {
    assert.match(sql, /drop function if exists public\.tmf_monthly_market\(date, date, text\)/i);
    assert.match(sql, /security invoker/i);
    assert.doesNotMatch(sql, /security definer/i);
    assert.match(sql, /stable/i);
  });

  it("klassifiserer hydrogen som annet før diesel", () => {
    const hydrogenAt = lower.indexOf("ilike '%hydrogen%'");
    const dieselAt = lower.indexOf("ilike '%diesel%'");
    const gasAt = lower.lastIndexOf("ilike '%gas%'");
    assert.ok(hydrogenAt > 0);
    assert.ok(dieselAt > hydrogenAt);
    assert.ok(gasAt > hydrogenAt);
    assert.match(sql, /then 'other'/);
    assert.match(sql, /else 'other'/);
    assert.match(sql, /diesel_count/);
    assert.match(sql, /gas_count/);
    assert.match(sql, /other_count/);
  });

  it("gir execute tilbake til public, anon, authenticated og service_role uten revoke", () => {
    assert.match(
      sql,
      /grant execute on function public\.tmf_monthly_market\(date, date, text\) to public/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.tmf_monthly_market\(date, date, text\) to anon/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.tmf_monthly_market\(date, date, text\) to authenticated/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.tmf_monthly_market\(date, date, text\) to service_role/i,
    );
    assert.doesNotMatch(sql, /\brevoke\b/i);
  });
});
