import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import {
  runPopulationExport,
  type ClaimedPopulationExport,
  type PopulationExportDeps,
} from "@/lib/population/export-runner";
import type { PopulationExportRow } from "@/lib/population/export-shared";

const JOB = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";

function row(registrationNumber: string, owner = "Posten"): PopulationExportRow {
  return {
    registration_number: registrationNumber,
    make_name: "Volvo",
    model_name: "ukjent",
    variant_name: "FH",
    usage_name: "Godstransport",
    maximum_laden_mass_kg: 26000,
    first_registration_date: "2018-04-12",
    vehicle_status: "Registrert",
    primary_owner_name: owner,
    primary_owner_postal_code: "0001",
    primary_owner_postal_district: "Oslo",
    primary_user_name: "=1+1",
    primary_user_postal_code: "5003",
    primary_user_postal_district: "Bergen",
  };
}

function harness(options: {
  source: PopulationExportRow[];
  claim?: ClaimedPopulationExport | null;
  failFetch?: boolean;
  workbook?: Uint8Array;
}) {
  const uploaded: { path: string; bytes: Uint8Array }[] = [];
  const ready: { rowCount: number; truncated: boolean; storagePath: string }[] = [];
  const failed: string[] = [];
  const progress: number[] = [];

  const claim: ClaimedPopulationExport = options.claim ?? {
    id: JOB,
    userId: USER,
    filters: { make: "Volvo", bodywork: "-1", disp: "0", age: "under10", q: "Posten" },
    snapshotDate: "2026-10-01",
  };

  const deps: PopulationExportDeps = {
    async claim() {
      return options.claim === null ? null : claim;
    },
    async fetchPage(args) {
      if (options.failFetch) throw new Error("statement timeout");
      assert.equal(args.p_make, "Volvo");
      assert.equal(args.p_bodywork, -1);
      assert.equal(args.p_disp, 0);
      assert.equal(args.p_age, "under10");
      assert.equal(args.p_q, "Posten");
      assert.equal(args.p_snapshot_date, "2026-10-01");
      return options.source
        .filter(
          (item) =>
            args.p_after_registration_number === null ||
            item.registration_number > args.p_after_registration_number,
        )
        .slice(0, args.p_limit);
    },
    async updateProgress(_jobId, rowsFetched) {
      progress.push(rowsFetched);
    },
    async upload(path, bytes) {
      uploaded.push({ path, bytes });
    },
    async markReady(_jobId, result) {
      ready.push(result);
    },
    async markFailed(_jobId, message) {
      failed.push(message);
    },
    now: () => new Date("2026-10-27T12:00:00.000Z"),
    pageSize: 2,
    maxRows: 4,
    buildWorkbook: options.workbook ? () => options.workbook! : undefined,
  };

  return { deps, uploaded, ready, failed, progress };
}

describe("runPopulationExport", () => {
  it("pages with a keyset, uploads a workbook Excel can open, and keeps filters", async () => {
    const source = ["AA1", "AA2", "AA3"].map((registration) => row(registration));
    const { deps, uploaded, ready, failed, progress } = harness({ source });

    const result = await runPopulationExport(JOB, deps);

    assert.equal(result, "done");
    assert.deepEqual(failed, []);
    assert.deepEqual(progress, [2, 3]);
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0]?.path, `${USER}/${JOB}.xlsx`);
    const bytes = uploaded[0]?.bytes;
    assert.ok(bytes);
    assert.equal(isCompleteXlsx(bytes), true);
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const sheet = workbook.Sheets.Data;
    assert.ok(sheet);
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
    assert.equal(rows.length, 4);
    assert.equal(rows[1]?.[0], "AA1");
    assert.equal(rows[1]?.[2], "FH");
    assert.equal(rows[1]?.[11], "'=1+1");
    assert.deepEqual(ready, [
      {
        rowCount: 3,
        truncated: false,
        storagePath: `${USER}/${JOB}.xlsx`,
      },
    ]);
  });

  it("marks the file truncated when the row cap is hit on a full page", async () => {
    const source = ["AA1", "AA2", "AA3", "AA4", "AA5"].map((registration) =>
      row(registration),
    );
    const { deps, ready } = harness({ source });
    await runPopulationExport(JOB, deps);
    assert.equal(ready[0]?.rowCount, 4);
    assert.equal(ready[0]?.truncated, true);
  });

  it("does nothing when the job is already claimed", async () => {
    const { deps, uploaded, failed } = harness({ source: [], claim: null });
    const result = await runPopulationExport(JOB, deps);
    assert.equal(result, "skipped");
    assert.equal(uploaded.length, 0);
    assert.deepEqual(failed, []);
  });

  it("stores a generic failure when the database call fails", async () => {
    const { deps, uploaded, failed } = harness({ source: [], failFetch: true });
    const result = await runPopulationExport(JOB, deps);
    assert.equal(result, "done");
    assert.equal(uploaded.length, 0);
    assert.deepEqual(failed, ["Eksporten feilet. Prøv igjen."]);
  });

  it("refuses to upload a workbook that is not a complete zip", async () => {
    const { deps, uploaded, failed } = harness({
      source: [row("AA1")],
      workbook: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
    });
    await runPopulationExport(JOB, deps);
    assert.equal(uploaded.length, 0);
    assert.deepEqual(failed, ["Eksporten ble ufullstendig."]);
  });

  it("fails closed when there is no snapshot", async () => {
    const { deps, failed } = harness({
      source: [],
      claim: {
        id: JOB,
        userId: USER,
        filters: {},
        snapshotDate: null,
      },
    });
    await runPopulationExport(JOB, deps);
    assert.deepEqual(failed, ["Eksporten mangler bestandssnapshot."]);
  });
});
