import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scheduleFullPopulationExport } from "@/lib/sync/schedule-population-export";

describe("scheduleFullPopulationExport", () => {
  it("asks for a forced rebuild after a population sync", async () => {
    const calls: { force: boolean; wait: boolean }[] = [];
    await scheduleFullPopulationExport(async (options) => {
      calls.push(options);
    });
    assert.deepEqual(calls, [{ force: true, wait: true }]);
  });

  it("keeps the sync successful when the export cannot start", async () => {
    await scheduleFullPopulationExport(async () => {
      throw new Error("bakgrunn nede");
    });
  });
});