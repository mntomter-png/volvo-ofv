import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatOrgNr, normalizeOrgNr } from "@/lib/fleet/central-orgs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("normalizeOrgNr", () => {
  it("godtar ni siffer med og uten mellomrom", () => {
    assert.equal(normalizeOrgNr("879263662"), "879263662");
    assert.equal(normalizeOrgNr("879 263 662"), "879263662");
    assert.equal(formatOrgNr("879263662"), "879 263 662");
  });

  it("avviser annet enn ni siffer", () => {
    assert.equal(normalizeOrgNr(""), null);
    assert.equal(normalizeOrgNr("12345678"), null);
    assert.equal(normalizeOrgNr("8792636621"), null);
    assert.equal(normalizeOrgNr("Norsk Scania"), null);
  });
});

describe("central fleet migration", () => {
  const sql = read(
    "supabase/migrations/20261102065936_competitor_central_fleet_orgs.sql",
  );
  const previous = read(
    "supabase/migrations/20261101135808_nyreg_filter_scope.sql",
  );
  const previousRegion = previous.slice(
    previous.indexOf("create function public.reg_summary_by_region("),
    previous.indexOf("create function public.reg_data_freshness("),
  );

  it("beholder chassis-treffet og legger konkurrentregelen bare på Kun Region", () => {
    const vinLine = "fv.vin = upper(r.vin)";
    assert.equal(count(sql, vinLine), count(previousRegion, vinLine));
    assert.equal(
      count(sql, "when 'fleet' then is_fleet_focus"),
      8,
    );
    // Åtte funksjoner, pluss samme vilkår i kommentarene øverst.
    assert.equal(
      count(sql, "when 'region' then not is_fleet_focus and not is_competitor_central"),
      9,
    );
    assert.equal(sql.includes("when 'fleet' then is_fleet_focus or"), false);
    assert.equal(count(sql, "ofv_is_competitor_central_deal("), 16);
  });

  it("seeder importørene og ikke regionale forhandlere eller finans", () => {
    for (const orgnr of [
      "879263662",
      "824387842",
      "926342347",
      "826342552",
      "910712799",
    ]) {
      assert.ok(sql.includes(orgnr), orgnr);
    }
    assert.equal(sql.includes("966907916"), false);
    assert.equal(sql.includes("936279201"), false);
    assert.equal(sql.includes("977068983"), false);
  });

  it("holder lesing som invoker og skriving som super", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /grant select on table public\.central_fleet_orgs to authenticated/);
    assert.match(
      sql,
      /revoke all on table public\.central_fleet_orgs from public, anon, authenticated/,
    );
    assert.match(sql, /security invoker/);
    assert.match(sql, /security definer/);
    assert.match(sql, /jwt_can_manage_fleet_vins\(\)/);
    assert.match(sql, /revoke all on function public\.ofv_is_competitor_central_deal/);
    assert.equal(/grant execute[\s\S]*?to anon/i.test(sql), false);
    assert.match(sql, /ofv_is_competitor_central_deal skal være security invoker/);
  });
});

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}
