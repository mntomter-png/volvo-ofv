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
        DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
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
      "https://volvo-ofv.netlify.app/.netlify/functions/population-export-background",
    );
    assert.equal(calls[0]?.authorization, "Bearer hemmelig");
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), { jobId: JOB });
  });

  it("rejects a background start that does not return 202", async () => {
    await assert.rejects(
      () =>
        dispatchPopulationExport(JOB, {
          env: {
            NETLIFY: "true",
            URL: "https://app.biloversikt.com",
            DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
            SYNC_SECRET: "x",
          },
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
          DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
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
      "https://volvo-ofv.netlify.app/.netlify/functions/population-export-background",
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

  it("posts to the background function on Netlify runtime without NETLIFY=true", async () => {
    const calls: { url: string; body: string }[] = [];
    let inline = false;
    await dispatchPopulationExport(JOB, {
      env: {
        URL: "https://app.biloversikt.com/",
        DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
        SYNC_SECRET: "hemmelig",
      },
      async fetchImpl(input, init) {
        calls.push({ url: String(input), body: String(init?.body) });
        return new Response(null, { status: 202 });
      },
      runInline: async () => {
        inline = true;
      },
    });
    assert.equal(inline, false);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://volvo-ofv.netlify.app/.netlify/functions/population-export-background",
    );
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), { jobId: JOB });
  });

  it("does not build the full workbook in-process when only runtime vars are set", async () => {
    const calls: { body: string }[] = [];
    let inline = false;
    await dispatchPopulationFullExport(
      { force: true, wait: true },
      {
        env: {
          URL: "https://app.biloversikt.com",
          DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
          SYNC_SECRET: "hemmelig",
        },
        async fetchImpl(_input, init) {
          calls.push({ body: String(init?.body) });
          return new Response(null, { status: 202 });
        },
        runInline: async () => {
          inline = true;
        },
      },
    );
    assert.equal(inline, false);
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), { full: true, force: true });
  });

  it("treats SITE_ID as Netlify runtime and refuses to build in-process", async () => {
    let inline = false;
    await assert.rejects(
      () =>
        dispatchPopulationFullExport(
          { force: true, wait: true },
          {
            env: { SITE_ID: "1d01c0c0-4554-4747-93b8-34ce3448ab95" },
            async fetchImpl() {
              throw new Error("skal ikke kalles");
            },
            runInline: async () => {
              inline = true;
            },
          },
        ),
      /ikke konfigurert/,
    );
    assert.equal(inline, false);
  });

  it("keeps a local SYNC_SECRET on the in-process path", async () => {
    let ran = "";
    await dispatchPopulationExport(JOB, {
      env: { SYNC_SECRET: "hemmelig" },
      async fetchImpl() {
        throw new Error("skal ikke kalles");
      },
      runInline: async (jobId) => {
        ran = jobId;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ran, JOB);
  });

  it("gives up when the background function never answers", async () => {
    let inline = false;
    await assert.rejects(
      () =>
        dispatchPopulationFullExport(
          { force: true, wait: true },
          {
            env: {
              URL: "https://app.biloversikt.com",
              DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
              SYNC_SECRET: "hemmelig",
            },
            backgroundTimeoutMs: 30,
            async fetchImpl(_input, init): Promise<Response> {
              return await new Promise((_resolve, reject) => {
                const signal = init?.signal;
                if (!signal) {
                  reject(new Error("mangler signal"));
                  return;
                }
                signal.addEventListener("abort", () => reject(signal.reason), {
                  once: true,
                });
              });
            },
            runInline: async () => {
              inline = true;
            },
          },
        ),
      /ikke i tide/,
    );
    assert.equal(inline, false);
  });

  it("waits for the local full build so the sync process can exit afterwards", async () => {
    let finished = false;
    await dispatchPopulationFullExport(
      { force: true, wait: true },
      {
        env: {},
        runInline: async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          finished = true;
        },
      },
    );
    assert.equal(finished, true);
  });

  it("uses the site name when the only address is the custom domain", async () => {
    let url = "";
    await dispatchPopulationFullExport(
      { force: true },
      {
        env: {
          URL: "https://app.biloversikt.com",
          SITE_NAME: "volvo-ofv",
          SYNC_SECRET: "hemmelig",
        },
        async fetchImpl(input) {
          url = String(input);
          return new Response(null, { status: 202 });
        },
      },
    );
    assert.equal(
      url,
      "https://volvo-ofv.netlify.app/.netlify/functions/population-export-background",
    );
  });

  it("treats a 200 from the website as a failed start", async () => {
    await assert.rejects(
      () =>
        dispatchPopulationFullExport(
          { force: true },
          {
            env: {
              URL: "https://app.biloversikt.com",
              DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
              SYNC_SECRET: "hemmelig",
            },
            async fetchImpl() {
              return new Response("<html>", { status: 200 });
            },
          },
        ),
      /Kunne ikke starte eksport \(200\) mot volvo-ofv\.netlify\.app/,
    );
  });

  it("records a Cloudflare 403 instead of treating the call as started", async () => {
    await assert.rejects(
      () =>
        dispatchPopulationFullExport(
          { force: true },
          {
            env: {
              DEPLOY_PRIME_URL: "https://volvo-ofv.netlify.app",
              SYNC_SECRET: "hemmelig",
            },
            async fetchImpl() {
              return new Response("challenge", { status: 403 });
            },
          },
        ),
      /Kunne ikke starte eksport \(403\) mot volvo-ofv\.netlify\.app/,
    );
  });
});
