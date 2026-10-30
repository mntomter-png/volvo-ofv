import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runOfvSyncPhases } from "@/lib/sync/ofv-sync-phases";

const counts = (fetched: number) => ({ fetched, upserted: fetched });

describe("runOfvSyncPhases", () => {
  it("schedules the full export only after registrations and the sync log", async () => {
    const order: string[] = [];
    const result = await runOfvSyncPhases({
      population: async () => {
        order.push("population");
        return counts(10);
      },
      registrations: async () => {
        order.push("registrations");
        return counts(4);
      },
      finish: async (status) => {
        order.push(status);
      },
      scheduleExport: async () => {
        order.push("export");
      },
    });

    assert.deepEqual(order, [
      "population",
      "registrations",
      "completed",
      "export",
    ]);
    assert.equal(result.registrations?.fetched, 4);
    assert.equal(result.population?.fetched, 10);
  });

  it("reaches registrations and completes when export dispatch throws", async () => {
    const order: string[] = [];
    const result = await runOfvSyncPhases({
      population: async () => {
        order.push("population");
        return counts(1);
      },
      registrations: async () => {
        order.push("registrations");
        return counts(2);
      },
      finish: async (status) => {
        order.push(status);
      },
      scheduleExport: async () => {
        order.push("export");
        throw new Error("bakgrunn nede");
      },
      logExportError: () => {},
    });

    assert.deepEqual(order, [
      "population",
      "registrations",
      "completed",
      "export",
    ]);
    assert.equal(result.registrations?.fetched, 2);
  });

  it("reaches registrations and marks the sync complete when export dispatch hangs", async () => {
    const order: string[] = [];
    let exportStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      exportStarted = resolve;
    });

    const phases = runOfvSyncPhases({
      population: async () => {
        order.push("population");
        return counts(1);
      },
      registrations: async () => {
        order.push("registrations");
        return counts(3);
      },
      finish: async (status) => {
        order.push(status);
      },
      scheduleExport: () => {
        order.push("export");
        exportStarted();
        return new Promise(() => {});
      },
      logExportError: () => {},
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        started,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("registrations blocked by export")),
            500,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    assert.deepEqual(order, [
      "population",
      "registrations",
      "completed",
      "export",
    ]);
    void phases.catch(() => {});
  });

  it("schedules after a population-only sync", async () => {
    const order: string[] = [];
    await runOfvSyncPhases({
      population: async () => {
        order.push("population");
        return counts(8);
      },
      registrations: null,
      finish: async (status) => {
        order.push(status);
      },
      scheduleExport: async () => {
        order.push("export");
      },
    });
    assert.deepEqual(order, ["population", "completed", "export"]);
  });

  it("does not schedule an export for a registrations-only sync", async () => {
    let scheduled = false;
    const result = await runOfvSyncPhases({
      population: null,
      registrations: async () => counts(7),
      finish: async () => {},
      scheduleExport: async () => {
        scheduled = true;
      },
    });
    assert.equal(scheduled, false);
    assert.equal(result.population, undefined);
    assert.equal(result.registrations?.fetched, 7);
  });

  it("still schedules after population when registrations fail", async () => {
    const order: string[] = [];
    await assert.rejects(
      () =>
        runOfvSyncPhases({
          population: async () => {
            order.push("population");
            return counts(1);
          },
          registrations: async () => {
            order.push("registrations");
            throw new Error("reg feilet");
          },
          finish: async (status) => {
            order.push(status);
          },
          scheduleExport: async () => {
            order.push("export");
          },
        }),
      /reg feilet/,
    );
    assert.deepEqual(order, ["population", "registrations", "failed", "export"]);
  });

  it("does not schedule or fetch registrations when population fails", async () => {
    const order: string[] = [];
    await assert.rejects(
      () =>
        runOfvSyncPhases({
          population: async () => {
            order.push("population");
            throw new Error("bestand feilet");
          },
          registrations: async () => {
            order.push("registrations");
            return counts(1);
          },
          finish: async (status) => {
            order.push(status);
          },
          scheduleExport: async () => {
            order.push("export");
          },
        }),
      /bestand feilet/,
    );
    assert.deepEqual(order, ["population", "failed"]);
  });
});
