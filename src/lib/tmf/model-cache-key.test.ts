import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  referenceFromDayKey,
  tmfModelCacheKey,
  tmfModelDayKey,
} from "@/lib/tmf/model-cache-key";

describe("tmfModelCacheKey", () => {
  const base = {
    dataVersion: 7477,
    ssbSyncedAt: "2026-10-01T08:00:00.000Z",
    day: "2026-10-31",
    focusMake: "Volvo",
  };

  it("includes the registrations version, SSB time, day and make", () => {
    assert.equal(
      tmfModelCacheKey(base),
      "7477|2026-10-01T08:00:00.000Z|2026-10-31|Volvo",
    );
  });

  it("changes when the registrations version changes", () => {
    const next = tmfModelCacheKey({ ...base, dataVersion: 7478 });
    assert.notEqual(next, tmfModelCacheKey(base));
  });

  it("changes when SSB is synced again", () => {
    const next = tmfModelCacheKey({
      ...base,
      ssbSyncedAt: "2026-10-02T08:00:00.000Z",
    });
    assert.notEqual(next, tmfModelCacheKey(base));
  });

  it("uses a stable token when SSB has never been synced", () => {
    assert.equal(
      tmfModelCacheKey({ ...base, ssbSyncedAt: null }),
      "7477|no-ssb|2026-10-31|Volvo",
    );
  });
});

describe("tmfModelDayKey", () => {
  it("uses the local calendar day, not the clock time", () => {
    const morning = new Date(2026, 9, 31, 0, 30, 0);
    const evening = new Date(2026, 9, 31, 23, 15, 0);
    assert.equal(tmfModelDayKey(morning), "2026-10-31");
    assert.equal(tmfModelDayKey(evening), tmfModelDayKey(morning));
  });

  it("rebuilds a reference on the same calendar day", () => {
    const day = "2026-01-15";
    const reference = referenceFromDayKey(day);
    assert.equal(tmfModelDayKey(reference), day);
    assert.equal(reference.getMonth(), 0);
    assert.equal(reference.getDate(), 15);
  });

  it("rejects a day key the cache cannot turn back into a date", () => {
    assert.throws(() => referenceFromDayKey("31.10.2026"), /Ugyldig TMF-cachedag/);
  });
});
