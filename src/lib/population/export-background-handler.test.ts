import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handlePopulationExportBackground } from "@/lib/population/export-background-handler";

const JOB = "22222222-2222-4222-8222-222222222222";

function request(authorization: string | null, body: unknown): Request {
  return new Request("https://example.test/.netlify/functions/population-export-background", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handlePopulationExportBackground", () => {
  it("rejects a missing secret before touching the job", async () => {
    let ran = false;
    const response = await handlePopulationExportBackground(
      request(null, { jobId: JOB }),
      {
        env: { SYNC_SECRET: "hemmelig" },
        run: async () => {
          ran = true;
        },
      },
    );
    assert.equal(response.status, 401);
    assert.equal(ran, false);
  });

  it("rejects a job id that is not a uuid", async () => {
    const response = await handlePopulationExportBackground(
      request("Bearer hemmelig", { jobId: "../etc/passwd" }),
      {
        env: { SYNC_SECRET: "hemmelig" },
        run: async () => {
          throw new Error("skal ikke kjøre");
        },
      },
    );
    assert.equal(response.status, 400);
  });

  it("runs the claimed job when the secret matches", async () => {
    let ran = "";
    const response = await handlePopulationExportBackground(
      request("Bearer hemmelig", { jobId: JOB }),
      {
        env: { SYNC_SECRET: "hemmelig" },
        run: async (jobId) => {
          ran = jobId;
        },
      },
    );
    assert.equal(response.status, 200);
    assert.equal(ran, JOB);
  });

  it("builds the shared full file when asked, and can skip a forced rebuild", async () => {
    const calls: boolean[] = [];
    const response = await handlePopulationExportBackground(
      request("Bearer hemmelig", { full: true, force: false }),
      {
        env: { SYNC_SECRET: "hemmelig" },
        run: async () => {
          throw new Error("skal ikke kjøre jobb");
        },
        runFull: async ({ force }) => {
          calls.push(force);
        },
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [false]);
  });

  it("returns 500 when the job runner throws", async () => {
    const response = await handlePopulationExportBackground(
      request("Bearer hemmelig", { jobId: JOB }),
      {
        env: { SYNC_SECRET: "hemmelig" },
        run: async () => {
          throw new Error("storage nede");
        },
      },
    );
    assert.equal(response.status, 500);
  });
});
