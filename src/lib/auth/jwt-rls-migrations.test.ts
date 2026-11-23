import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

function latestFunctionBody(name: string): { file: string; body: string } {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`,
    "i",
  );
  let latest: { file: string; body: string } | null = null;
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const match = sql.match(pattern);
    if (match?.[0]) {
      latest = { file, body: match[0] };
    }
  }
  assert.ok(latest, `fant ingen definisjon av ${name}`);
  return latest;
}

describe("jwt RLS helpers (latest migrations)", () => {
  it("jwt_app_role is fail-closed without a salg default", () => {
    const { file, body } = latestFunctionBody("jwt_app_role");
    assert.equal(file, "20260820090000_jwt_app_role_fail_closed.sql");
    assert.match(body, /nullif\(auth\.jwt\(\)->'app_metadata'->>'role', ''\)/);
    assert.doesNotMatch(body, /coalesce\([^)]*'salg'/i);
  });

  it("jwt_can_read helpers do not allow legacy admin", () => {
    for (const name of [
      "jwt_can_read_registrations",
      "jwt_can_read_population",
      "jwt_can_read_sync_logs",
      "jwt_can_read_ssb_indicators",
    ]) {
      const { body } = latestFunctionBody(name);
      assert.doesNotMatch(body, /'admin'/);
    }
  });
});
