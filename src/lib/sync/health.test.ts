import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSyncHealthDetail,
  formatLastCheckedLine,
  resolveSyncHealth,
  syncHealthStatusLabel,
  type OfvSyncHealth,
} from "@/lib/sync/health";

function health(overrides: Partial<OfvSyncHealth> = {}): OfvSyncHealth {
  return {
    lastFullSyncAt: "2026-10-23T10:00:00.000Z",
    lastFullDataVersion: 7477,
    lastFullPublishDate: "2026-10-23",
    lastAnySyncAt: "2026-10-23T10:00:00.000Z",
    hoursSinceLastSync: 2,
    staleRunningLocks: 0,
    latestPopulationSnapshot: "2026-10-23",
    latestPopulationRows: 65600,
    populationIncomplete: false,
    populationSnapshotCount: 1,
    populationPruneError: null,
    lastSkipAt: null,
    lastSkipDataVersion: null,
    lastSkipReason: null,
    ofvLivePublishDate: "2026-10-23",
    ofvLiveDataVersion: 7477,
    ofvStatusAvailable: true,
    ofvAhead: false,
    status: "ok",
    reason: "ok",
    ...overrides,
  };
}

describe("resolveSyncHealth", () => {
  it("er ok med én bestandsversjon og fersk synk", () => {
    assert.deepEqual(resolveSyncHealth(2, 0, false, true, false, 1, null), {
      status: "ok",
      reason: "ok",
    });
  });

  it("advarer når mer enn én bestandsversjon ligger igjen", () => {
    assert.deepEqual(resolveSyncHealth(2, 0, false, true, false, 8, null), {
      status: "warning",
      reason: "population_snapshots_excess",
    });
  });

  it("advarer når siste opprydding feilet, selv med én versjon", () => {
    assert.deepEqual(
      resolveSyncHealth(
        2,
        0,
        false,
        true,
        false,
        1,
        "Populasjonsopprydding: canceling statement due to statement timeout",
      ),
      { status: "warning", reason: "population_prune_failed" },
    );
  });

  it("lar oppryddingsfeil skjule overflødige versjoner", () => {
    const result = resolveSyncHealth(
      2,
      0,
      false,
      true,
      false,
      4,
      "Populasjonsopprydding: lock timeout",
    );
    assert.equal(result.reason, "population_prune_failed");
  });

  it("lar ufullstendig bestand være kritisk foran opprydding og antall", () => {
    assert.deepEqual(
      resolveSyncHealth(2, 0, false, true, true, 6, "Populasjonsopprydding: feil"),
      { status: "critical", reason: "population_incomplete" },
    );
  });

  it("lar utdatert synk være kritisk selv om flere versjoner finnes", () => {
    assert.equal(
      resolveSyncHealth(80, 0, false, true, false, 5, null).reason,
      "sync_stale",
    );
  });

  it("viser overflødige versjoner foran «ny OFV-data»", () => {
    assert.equal(
      resolveSyncHealth(2, 0, true, true, false, 2, null).reason,
      "population_snapshots_excess",
    );
  });

  it("ignorerer tom oppryddingsfeil", () => {
    assert.equal(
      resolveSyncHealth(2, 0, false, true, false, 1, "   ").reason,
      "ok",
    );
  });

  it("behandler ukjent antall (0) som ikke-overflødig", () => {
    assert.equal(
      resolveSyncHealth(2, 0, false, true, false, 0, null).reason,
      "ok",
    );
  });
});

describe("syncHealthStatusLabel", () => {
  it("navngir de nye grunnene", () => {
    assert.equal(
      syncHealthStatusLabel("warning", "population_snapshots_excess"),
      "Flere bestandsversjoner",
    );
    assert.equal(
      syncHealthStatusLabel("warning", "population_prune_failed"),
      "Bestandsopprydding feilet",
    );
  });
});

describe("buildSyncHealthDetail", () => {
  it("tar med antall versjoner og oppryddingsfeil", () => {
    const detail = buildSyncHealthDetail(
      health({
        populationSnapshotCount: 8,
        populationPruneError:
          "Populasjonsopprydding: canceling statement due to statement timeout",
      }),
    );
    assert.match(detail, /8 bestandsversjoner/);
    assert.match(detail, /Populasjonsopprydding: canceling statement/);
  });

  it("nevner ikke versjoner når det bare er én", () => {
    const detail = buildSyncHealthDetail(health());
    assert.equal(detail.includes("bestandsversjoner"), false);
    assert.equal(detail.includes("sist sjekket"), false);
  });

  it("viser siste sjekk når versjonen allerede er synket", () => {
    const detail = buildSyncHealthDetail(
      health({
        lastAnySyncAt: "2026-10-23T10:00:00.000Z",
        lastFullDataVersion: 7477,
        lastSkipAt: "2026-10-24T10:00:00.000Z",
        lastSkipDataVersion: 7477,
        lastSkipReason: "dataVersion 7477 er allerede synket",
        hoursSinceLastSync: 30,
      }),
    );
    assert.match(detail, /sist synket /);
    assert.match(detail, /sist sjekket .+ – ingen nye data/);
    assert.equal(
      resolveSyncHealth(30, 0, false, true).reason,
      "sync_delayed",
    );
    assert.equal(
      syncHealthStatusLabel("warning", "sync_delayed"),
      "Datasynk forsinket",
    );
  });

  it("lar en fersk sjekk uten nye data være ute av drift når siste synk er gammel", () => {
    assert.equal(
      resolveSyncHealth(55, 0, false, true).reason,
      "sync_stale",
    );
    assert.equal(
      syncHealthStatusLabel("critical", "sync_stale"),
      "Datasynk ute av drift",
    );
    const line = formatLastCheckedLine(
      health({
        hoursSinceLastSync: 55,
        lastAnySyncAt: "2026-10-21T10:00:00.000Z",
        lastFullDataVersion: 7477,
        lastSkipAt: "2026-10-24T10:00:00.000Z",
        lastSkipDataVersion: 7477,
        lastSkipReason: "dataVersion 7477 er allerede synket",
      }),
    );
    assert.match(line ?? "", /ingen nye data/);
  });

  it("skjuler sjekken når en vellykket synk er nyere", () => {
    assert.equal(
      formatLastCheckedLine(
        health({
          lastAnySyncAt: "2026-10-24T12:00:00.000Z",
          lastSkipAt: "2026-10-24T10:00:00.000Z",
          lastSkipDataVersion: 7477,
          lastFullDataVersion: 7477,
          lastSkipReason: "dataVersion 7477 er allerede synket",
        }),
      ),
      null,
    );
  });

  it("sier ikke ingen nye data når OFV har publisert en nyere versjon", () => {
    assert.equal(
      formatLastCheckedLine(
        health({
          ofvAhead: true,
          ofvLiveDataVersion: 7478,
          lastFullDataVersion: 7477,
          lastAnySyncAt: "2026-10-23T10:00:00.000Z",
          lastSkipAt: "2026-10-24T10:00:00.000Z",
          lastSkipDataVersion: 7477,
          lastSkipReason: "dataVersion 7477 er allerede synket",
        }),
      ),
      null,
    );
  });

  it("viser annen skip-årsak som tekst", () => {
    const line = formatLastCheckedLine(
      health({
        lastAnySyncAt: "2026-10-23T10:00:00.000Z",
        lastSkipAt: "2026-10-24T10:00:00.000Z",
        lastSkipDataVersion: 7477,
        lastSkipReason: "manuelt hoppet over",
      }),
    );
    assert.match(line ?? "", /sist sjekket .+ – manuelt hoppet over/);
    assert.equal((line ?? "").includes("ingen nye data"), false);
  });
});
