import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { roleCanUseFleetRegionFilter } from "@/lib/auth/role-config";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20261116090512_fleet_register_select_leder_super.sql",
);

describe("fleet register SELECT RLS", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("replaces world-readable SELECT with leder/super", () => {
    assert.match(sql, /drop policy if exists "Authenticated read fleet vins"/i);
    assert.match(sql, /drop policy if exists "Authenticated read fleet chassis"/i);
    assert.match(sql, /jwt_app_role\(\)\) in \('leder', 'super'\)/);
    assert.match(sql, /Leder read fleet vins/);
    assert.match(sql, /Leder read fleet chassis/);
    assert.match(sql, /fleet_vins\/fleet_chassis har fortsatt SELECT using \(true\)/);
  });

  it("matches the app-layer fleet filter roles", () => {
    assert.equal(roleCanUseFleetRegionFilter("leder"), true);
    assert.equal(roleCanUseFleetRegionFilter("super"), true);
    assert.equal(roleCanUseFleetRegionFilter("salg"), false);
    assert.equal(roleCanUseFleetRegionFilter("service"), false);
    assert.equal(roleCanUseFleetRegionFilter("pkk"), false);
  });
});
