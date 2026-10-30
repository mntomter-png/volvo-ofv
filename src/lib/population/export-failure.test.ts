import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { markCurrentFullExportFailed } from "@/lib/population/export-supabase";

describe("markCurrentFullExportFailed", () => {
  it("writes the dispatch error and timestamp onto a stuck building row", async () => {
    const failed: { snapshot: string; message: string }[] = [];
    await markCurrentFullExportFailed(
      "Kunne ikke starte eksport (403) mot app.biloversikt.com.",
      {
        async currentSnapshot() {
          return "2026-10-29";
        },
        async read() {
          return { status: "building", storagePath: null };
        },
        async markFailed(snapshot, message) {
          failed.push({ snapshot, message });
        },
      },
    );
    assert.deepEqual(failed, [
      {
        snapshot: "2026-10-29",
        message: "Kunne ikke starte eksport (403) mot app.biloversikt.com.",
      },
    ]);
  });

  it("leaves a ready file in place when dispatch fails", async () => {
    let marked = false;
    await markCurrentFullExportFailed("nettverk nede", {
      async currentSnapshot() {
        return "2026-10-29";
      },
      async read() {
        return { status: "ready", storagePath: "full/2026-10-29.xlsx" };
      },
      async markFailed() {
        marked = true;
      },
    });
    assert.equal(marked, false);
  });

  it("does nothing when there is no snapshot", async () => {
    let marked = false;
    await markCurrentFullExportFailed("nettverk nede", {
      async currentSnapshot() {
        return null;
      },
      async read() {
        throw new Error("skal ikke lese");
      },
      async markFailed() {
        marked = true;
      },
    });
    assert.equal(marked, false);
  });
});