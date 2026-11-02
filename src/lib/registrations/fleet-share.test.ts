import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FLEET_DEALER_LABEL } from "@/lib/fleet";
import { buildFleetVinSetFromChassisSheet } from "@/lib/fleet";
import {
  FLEET_FILTER_DEFINITIONS,
  FLEET_REGION_COMPETITOR_NOTE,
  REGION_NO_SELECTION_NOTE,
  focusSharePercent,
  nationalShareCaption,
  nationalVolumeShare,
} from "@/lib/registrations/fleet-share";

describe("focusSharePercent", () => {
  it("uses focus over volume for the full market", () => {
    assert.equal(
      focusSharePercent("all", { volume: 100, focus: 40, marketVolume: 100 }),
      40,
    );
  });

  it("uses the already adjusted region volume", () => {
    assert.equal(
      focusSharePercent("region", { volume: 80, focus: 30, marketVolume: 100 }),
      37.5,
    );
  });

  it("measures fleet against the whole market instead of 100 %", () => {
    assert.equal(
      focusSharePercent("fleet", { volume: 20, focus: 20, marketVolume: 100 }),
      20,
    );
  });

  it("returns 0 when the fleet market denominator is empty", () => {
    assert.equal(
      focusSharePercent("fleet", { volume: 5, focus: 5, marketVolume: 0 }),
      0,
    );
  });
});

describe("nationalVolumeShare", () => {
  it("divides by the same fleet universe nationally", () => {
    assert.equal(nationalVolumeShare(10, 40), 25);
    assert.equal(nationalVolumeShare(70, 200), 35);
  });

  it("returns 0 when the national total is empty", () => {
    assert.equal(nationalVolumeShare(4, 0), 0);
  });
});

describe("fleet copy", () => {
  it("names both fleet dealers and the national-share rule", () => {
    assert.match(FLEET_DEALER_LABEL, /896/);
    assert.match(FLEET_DEALER_LABEL, /890/);
    assert.match(FLEET_FILTER_DEFINITIONS.fleet, /ikke 100 %/);
    assert.match(FLEET_FILTER_DEFINITIONS.fleet, /landets fleet/);
    assert.match(FLEET_FILTER_DEFINITIONS.region, /samme utvalg nasjonalt/);
    assert.match(FLEET_REGION_COMPETITOR_NOTE, /Volvo Fleet/);
    assert.match(FLEET_REGION_COMPETITOR_NOTE, /sentrale organisasjoner/);
    assert.match(FLEET_REGION_COMPETITOR_NOTE, /regional forhandler/);
    assert.match(REGION_NO_SELECTION_NOTE, /nasjonal oversikt/);
    assert.doesNotMatch(REGION_NO_SELECTION_NOTE, /nasjonalt oversikt/);
    assert.match(nationalShareCaption("fleet", "120"), /fleet nasjonalt/);
    assert.match(nationalShareCaption("region", "900"), /uten Volvo Fleet/);
  });
});

describe("fleet dealer list", () => {
  it("keeps VINs from dealers 896 and 890", () => {
    const vins = buildFleetVinSetFromChassisSheet([
      ["VIN", "Dealer number"],
      ["YV2XT40A0RB123456", 896],
      ["YV2XT40A0RB123457", "890"],
      ["YV2XT40A0RB123458", 123],
    ]);
    assert.equal(vins.size, 2);
    assert.equal(vins.has("YV2XT40A0RB123456"), true);
    assert.equal(vins.has("YV2XT40A0RB123457"), true);
  });
});

describe("region fleet migration grants", () => {
  it("revokes anon and public and stays security invoker", () => {
    const migrationsDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/migrations",
    );
    const name = readdirSync(migrationsDir).find((entry) =>
      entry.endsWith("_region_fleet_tab_filter.sql"),
    );
    assert.ok(name, "mangler migrasjon region_fleet_tab_filter");
    const sql = readFileSync(join(migrationsDir, name), "utf8");
    assert.match(sql, /security invoker/);
    assert.match(sql, /revoke all on function %s from public, anon/);
    assert.doesNotMatch(sql, /grant execute on function[\s\S]*to anon/);
    assert.match(sql, /reg_region_scope_summary/);
    assert.match(sql, /reg_region_buyer_loyalty_owners/);
    assert.match(sql, /market_count/);
    assert.doesNotMatch(sql, /security definer/);
  });
});
