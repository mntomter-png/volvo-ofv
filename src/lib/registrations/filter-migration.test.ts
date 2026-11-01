import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../supabase/migrations/20261101135808_nyreg_filter_scope.sql",
  ),
  "utf8",
);

function body(name: string): string {
  const start = sql.indexOf(`create function public.${name}(`);
  const next = sql.indexOf("create function public.", start + 10);
  return sql.slice(start, next === -1 ? sql.length : next);
}

describe("nyreg_filter_scope-migrasjonen", () => {
  it("setter ikke tidssone på authenticator", () => {
    assert.equal(sql.includes("alter role"), false);
    assert.equal(/alter role authenticator/i.test(sql), false);
  });

  it("skriver Oslo-døgnet inn i predikatene og gir ikke anon EXECUTE", () => {
    assert.match(sql, /at time zone 'Europe\/Oslo'/);
    assert.equal(/grant execute[\s\S]*?to anon/i.test(sql), false);
    assert.ok(sql.includes("from public, anon"));
    assert.match(
      sql,
      /grant execute on function public\.reg_data_freshness\(\) to authenticated/,
    );
  });

  it("beholder kundekvalitet fra #28 sammen med søk", () => {
    const buyers = body("reg_top_buyers");
    assert.match(buyers, /ofv_is_placeholder_party/);
    assert.match(buyers, /p_exclude_channel/);
    assert.match(buyers, /ofv_is_channel_party/);
    assert.match(buyers, /ofv_disp_matches/);
    assert.match(buyers, /p_q text default null/);
    assert.match(buyers, /primary_user_orgnr/);

    const loyalty = body("reg_buyer_loyalty");
    const prior = loyalty.indexOf("prior_parties");
    assert.ok(loyalty.indexOf("p_q is null") < prior);
    assert.equal(loyalty.slice(prior).includes("p_q is null"), false);
    assert.equal(loyalty.split("ofv_is_placeholder_party").length - 1, 2);

    const decline = body("reg_owner_focus_decline_summary");
    assert.match(decline, /ofv_is_finance_or_importer/);
    assert.match(decline, /ofv_is_placeholder_party/);
    assert.match(decline, /p_make text default null/);
    assert.match(decline, /p_q text default null/);
  });

  it("beholder fleet-logikken fra #27 og søket fra #26", () => {
    const region = body("reg_summary_by_region");
    assert.match(region, /fleet_vins/);
    assert.match(region, /p_fleet_filter/);
    assert.match(region, /p_q is null/);
    assert.match(region, /Europe\/Oslo/);

    const regionBuyers = body("reg_region_top_buyers");
    assert.match(regionBuyers, /p_fleet_filter/);
    assert.match(regionBuyers, /fleet_vins/);
    assert.match(regionBuyers, /p_q text default null/);

    const pabygg = body("reg_make_share_by_pabygg");
    assert.match(pabygg, /p_q text default null/);
    assert.equal(pabygg.includes("search_path"), false);
    assert.match(pabygg, /Europe\/Oslo/);
  });
});
