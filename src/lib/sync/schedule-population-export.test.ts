import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scheduleFullPopulationExport } from "@/lib/sync/schedule-population-export";

describe("scheduleFullPopulationExport", () => {
  it("asks for a forced rebuild after a population sync", async () => {
    const calls: { force: boolean; wait: boolean }[] = [];
    await scheduleFullPopulationExport({
      dispatch: async (options) => {
        calls.push(options);
      },
    });
    assert.deepEqual(calls, [{ force: true, wait: true }]);
  });

  it("does not force a rebuild when the sync was skipped", async () => {
    const calls: { force: boolean; wait: boolean }[] = [];
    await scheduleFullPopulationExport({
      force: false,
      dispatch: async (options) => {
        calls.push(options);
      },
    });
    assert.deepEqual(calls, [{ force: false, wait: true }]);
  });

  it("keeps the sync successful and stores the start error", async () => {
    const recorded: string[] = [];
    await scheduleFullPopulationExport({
      dispatch: async () => {
        throw new Error("Kunne ikke starte eksport (403) mot app.biloversikt.com.");
      },
      recordFailure: async (message) => {
        recorded.push(message);
      },
    });
    assert.deepEqual(recorded, [
      "Kunne ikke starte eksport (403) mot app.biloversikt.com.",
    ]);
  });
});
