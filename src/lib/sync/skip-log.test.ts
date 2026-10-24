import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  SYNC_SKIP_LOG_KIND,
  buildSkipLogInsert,
  buildSkipLogRefresh,
  isReusableSkipLog,
  isUniqueViolation,
  planSkipWrite,
  syncSkipMessage,
  syncSkipMetadata,
} from "@/lib/sync/skip-log";

const healthMigration = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20261024120100_ofv_sync_health_last_skip.sql",
);

describe("syncSkipMessage", () => {
  it("tar med versjonen som ble sammenlignet", () => {
    assert.equal(
      syncSkipMessage("already_synced", 7477),
      "dataVersion 7477 er allerede synket",
    );
    assert.deepEqual(syncSkipMetadata("already_synced", 7477), {
      kind: SYNC_SKIP_LOG_KIND,
      reason: "already_synced",
      compared_version: 7477,
    });
  });
});

describe("planSkipWrite", () => {
  const checked = {
    dataVersion: 7477,
    publishDate: "2026-10-22",
    code: "already_synced" as const,
    checkedAt: "2026-10-24T10:00:00.000Z",
  };

  it("setter inn én skipped-rad og gjenbruker den ved neste sjekk", () => {
    assert.equal(planSkipWrite(null, "already_synced", 7477), "insert");

    const row = buildSkipLogInsert({ syncType: "full", ...checked });
    assert.equal(row.status, "skipped");
    assert.equal(row.ofv_data_version, 7477);
    assert.equal(row.records_fetched, 0);
    assert.equal("started_at" in row, false);

    const existing = {
      id: "skip-1",
      ofv_data_version: row.ofv_data_version,
      metadata: row.metadata,
    };
    assert.equal(isReusableSkipLog(existing, "already_synced", 7477), true);
    assert.equal(planSkipWrite(existing, "already_synced", 7477), "update");

    const refresh = buildSkipLogRefresh(checked);
    assert.equal("status" in refresh, false);
    assert.equal("started_at" in refresh, false);
    assert.equal(refresh.completed_at, checked.checkedAt);
    assert.equal(refresh.metadata.compared_version, 7477);
  });

  it("oppretter ny rad for en annen versjon eller en annen årsak", () => {
    const existing = {
      id: "skip-1",
      ofv_data_version: 7477,
      metadata: syncSkipMetadata("already_synced", 7477),
    };
    assert.equal(planSkipWrite(existing, "already_synced", 7478), "insert");
    assert.equal(isReusableSkipLog(existing, "already_synced", 7478), false);
  });

  it("gjenbruker ikke feilrader fra bestandsopprydding", () => {
    const prune = {
      id: "prune-1",
      ofv_data_version: 7477,
      metadata: { kind: "population_prune" },
    };
    assert.equal(planSkipWrite(prune, "already_synced", 7477), "insert");
  });

  it("kjenner unik-kollisjon når to sjekker skriver samtidig", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(
      isUniqueViolation({
        message: 'duplicate key value violates unique constraint "sync_logs_skip_version_reason_uidx"',
      }),
      true,
    );
    assert.equal(isUniqueViolation({ code: "22P02", message: "invalid enum" }), false);
  });
});

describe("ofv_sync_health-migrasjonen", () => {
  const sql = readFileSync(healthMigration, "utf8");

  it("holder skipped utenfor sist synket og timene som styrer status", () => {
    assert.match(
      sql,
      /where sync_type = 'full' and status = 'completed'\) as last_full_sync_at/,
    );
    assert.match(
      sql,
      /select max\(completed_at\) from public\.sync_logs where status = 'completed'/,
    );
    assert.match(sql, /where status = 'completed'\) as last_any_sync_at/);
    assert.equal(sql.includes("status in ('completed', 'skipped')"), false);
    assert.equal(sql.includes("create or replace function public.ofv_sync_watchdog"), false);
  });

  it("leser siste skip for seg, med versjon og grunn", () => {
    assert.match(
      sql,
      /where sync_type = 'full' and status = 'skipped'/,
    );
    assert.match(sql, /as last_skip_at/);
    assert.match(sql, /as last_skip_data_version/);
    assert.match(sql, /as last_skip_reason/);
  });
});
