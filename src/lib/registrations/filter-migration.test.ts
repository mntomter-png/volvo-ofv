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

describe("nyreg_filter_scope-migrasjonen", () => {
  it("setter Oslo-tidssone på API-rollen og search_path på funksjonene", () => {
    assert.match(sql, /alter role authenticator set timezone to 'Europe\/Oslo'/);
    assert.equal(sql.includes("alter role service_role"), false);
    assert.ok(sql.split("set search_path = public").length > 8);
  });

  it("gir ikke anon EXECUTE", () => {
    assert.equal(/grant execute[\s\S]*?to anon/i.test(sql), false);
    assert.ok(sql.includes("from public, anon"));
    assert.match(sql, /grant execute on function public\.reg_data_freshness\(\) to authenticated/);
    assert.match(sql, /grant execute on function public\.reg_filtered_count\(/);
    assert.match(sql, /grant execute on function public\.reg_filtered_page\(/);
  });

  it("legger søk på kjøpere, marked og kundelister uten å røre historikk-skannet", () => {
    assert.match(sql, /create function public\.reg_top_buyers\([\s\S]*p_q text default null/);
    assert.match(sql, /create function public\.reg_make_share_by_month\([\s\S]*p_q text default null/);
    assert.match(
      sql,
      /create function public\.reg_owner_focus_decline_summary\([\s\S]*p_make text default null/,
    );
    const loyalty = sql.slice(
      sql.indexOf("create function public.reg_buyer_loyalty("),
      sql.indexOf("create function public.reg_buyer_loyalty_owners("),
    );
    const prior = loyalty.indexOf("prior_parties");
    assert.ok(loyalty.indexOf("p_q is null") < prior);
    assert.equal(loyalty.slice(prior).includes("p_q is null"), false);

    const potential = sql.slice(sql.indexOf("function public.reg_potential_list"));
    const scoped = potential.indexOf("scoped as materialized");
    const q = potential.indexOf("p_q is null");
    assert.ok(scoped > 0 && q > scoped);
  });
});
