import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { followPopulationExport } from "@/lib/population/export-download";

const JOB = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("followPopulationExport", () => {
  it("shows progress and opens the signed url when the file is ready", async () => {
    const bodies = [
      { status: "queued", rowsFetched: 0, truncated: false, downloadUrl: null },
      { status: "running", rowsFetched: 2000, truncated: false, downloadUrl: null },
      {
        status: "ready",
        rowsFetched: 65575,
        rowCount: 65575,
        truncated: false,
        downloadUrl: "https://storage.example/sign/bestand.xlsx",
        error: null,
      },
    ];
    const progress: number[] = [];
    const opened: string[] = [];
    let clock = 0;

    const result = await followPopulationExport({
      jobId: JOB,
      statusUrl: `/api/export/population/status?id=${JOB}`,
      async fetchImpl() {
        const next = bodies.shift();
        return jsonResponse(next);
      },
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      onProgress: (rows) => progress.push(rows),
      openUrl: (url) => opened.push(url),
    });

    assert.deepEqual(progress, [0, 2000, 65575]);
    assert.deepEqual(opened, ["https://storage.example/sign/bestand.xlsx"]);
    assert.equal(result.truncated, false);
    assert.equal(result.rowCount, 65575);
  });

  it("surfaces a failed job without opening a url", async () => {
    const opened: string[] = [];
    await assert.rejects(
      () =>
        followPopulationExport({
          jobId: JOB,
          statusUrl: "/status",
          async fetchImpl() {
            return jsonResponse({
              status: "failed",
              rowsFetched: 1000,
              error: "Eksporten feilet. Prøv igjen.",
              downloadUrl: null,
            });
          },
          now: () => 0,
          sleep: async () => {},
          openUrl: (url) => opened.push(url),
        }),
      /Eksporten feilet/,
    );
    assert.deepEqual(opened, []);
  });

  it("stops when the job does not finish in time", async () => {
    let clock = 0;
    await assert.rejects(
      () =>
        followPopulationExport({
          jobId: JOB,
          statusUrl: "/status",
          timeoutMs: 4000,
          intervalMs: 2000,
          async fetchImpl() {
            return jsonResponse({ status: "running", rowsFetched: 1, downloadUrl: null });
          },
          now: () => clock,
          sleep: async (ms) => {
            clock += ms;
          },
          openUrl: () => {
            throw new Error("skal ikke åpne");
          },
        }),
      /tar for lang tid/,
    );
  });
});
