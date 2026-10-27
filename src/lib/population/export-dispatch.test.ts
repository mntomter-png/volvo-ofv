import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dispatchPopulationExport,
  dispatchPopulationFullExport,
} from "@/lib/population/export-dispatch";

const JOB = "22222222-2222-4222-8222-222222222222";

describe("dispatchPopulationExport", () => {
  it("calls the Netlify background function with the sync secret", async () => {
    const calls: { url: string; authorization: string | null; body: string }[] = [];
    await dispatchPopulationExport(JOB, {
      env: {
        NETLIFY: "true",
        URL: "https://app.biloversikt.com/",
        SYNC_SECRET: "hemmelig",
      },
      async fetchImpl(input, init) {
        calls.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
          body: String(init?.body),
        });
        return new Response(null, { status: 202 });
      },
      runInline: async () => {
        throw new Error("skal ikke kjøre inline");
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://app.biloversikt.com/.netlify/functions/population-export-background",
    );
    assert.equal(calls[0]?.authorization, "Bearer hemmelig");
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), { jobId: JOB });
  });

  it("rejects a background start that does not return 202", async () => {
    await assert.rejects(
      () =>
        dispatchPopulationExport(JOB, {
          env: { NETLIFY: "true", URL: "https://app.biloversikt.com", SYNC_SECRET: "x" },
          async fetchImpl() {
            return new Response("no", { status: 502 });
          },
        }),
      /Kunne ikke starte eksport \(502\)/,
    );
  });

  it("refuses to call Netlify without the shared secret", async () => {
    await assert.rejects(
      () =>
        dispatchPopulationExport(JOB, {
          env: { NETLIFY: "true", URL: "https://app.biloversikt.com" },
          async fetchImpl() {
            throw new Error("skal ikke kalles");
          },
        }),
      /ikke konfigurert/,
    );
  });

  it("asks the background function to rebuild the full file", async () => {
    const calls: { url: string; body: string }[] = [];
    await dispatchPopulationFullExport(
      { force: true },
      {
        env: {
          NETLIFY: "true",
          URL: "https://app.biloversikt.com",
          SYNC_SECRET: "hemmelig",
        },
        async fetchImpl(input, init) {
          calls.push({ url: String(input), body: String(init?.body) });
          return new Response(null, { status: 202 });
        },
        runInline: async () => {
          throw new Error("skal ikke kjøre inline");
        },
      },
    );
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://app.biloversikt.com/.netlify/functions/population-export-background",
    );
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), { full: true, force: true });
  });

  it("runs inline when the process is not on Netlify", async () => {
    let ran = "";
    await dispatchPopulationExport(JOB, {
      env: {},
      runInline: async (jobId) => {
        ran = jobId;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ran, JOB);
  });
});
