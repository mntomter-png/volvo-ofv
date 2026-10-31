import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import { type PopulationExportRow } from "@/lib/population/export-shared";
import {
  attachExportAbortHandler,
  runFullPopulationExport,
  type FullPopulationExportDeps,
} from "@/lib/population/export-full";

function row(registrationNumber: string): PopulationExportRow {
  return {
    registration_number: registrationNumber,
    make_name: "Volvo",
    model_name: "FH",
    variant_name: "FH",
    usage_name: "Godstransport",
    maximum_laden_mass_kg: 26000,
    first_registration_date: "2018-04-12",
    vehicle_status: "Registrert",
    primary_owner_name: "Posten",
    primary_owner_postal_code: "0001",
    primary_owner_postal_district: "Oslo",
    primary_user_name: "Posten",
    primary_user_postal_code: "5003",
    primary_user_postal_district: "Bergen",
  };
}

function harness(options: {
  claim: "claimed" | "ready" | "busy";
  source?: PopulationExportRow[];
  names?: string[];
}) {
  const uploaded: { path: string; type: string; bytes: Uint8Array }[] = [];
  const removed: string[][] = [];
  const ready: string[] = [];
  const failed: string[] = [];
  const stages: string[] = [];
  let forced = false;

  const deps: FullPopulationExportDeps = {
    async currentSnapshot() {
      return "2026-10-25";
    },
    async claim(_snapshot, force) {
      forced = force;
      return options.claim;
    },
    async fetchPage(args) {
      assert.equal(args.p_make, null);
      assert.equal(args.p_snapshot_date, "2026-10-25");
      return (options.source ?? [])
        .filter(
          (item) =>
            args.p_after_registration_number === null ||
            item.registration_number > args.p_after_registration_number,
        )
        .slice(0, args.p_limit);
    },
    async upload(path, bytes, type) {
      uploaded.push({ path, type, bytes });
    },
    async markReady(_snapshot, result) {
      ready.push(result.storagePath);
    },
    async markFailed(_snapshot, message) {
      failed.push(message);
    },
    async noteStage(_snapshot, stage) {
      stages.push(stage);
    },
    async listFull() {
      return options.names ?? [];
    },
    async remove(paths) {
      removed.push(paths);
    },
    now: () => new Date("2026-10-27T08:00:00.000Z"),
    pageSize: 1,
  };

  return { deps, uploaded, removed, ready, failed, stages, wasForced: () => forced };
}

describe("runFullPopulationExport", () => {
  it("skips when the current snapshot is already ready", async () => {
    const state = harness({ claim: "ready" });
    const result = await runFullPopulationExport(state.deps, { force: false });
    assert.equal(result, "skipped");
    assert.equal(state.wasForced(), false);
    assert.equal(state.uploaded.length, 0);
  });

  it("writes only the spreadsheet and drops older files", async () => {
    const state = harness({
      claim: "claimed",
      source: [row("AB1"), row("AB2")],
      names: ["2026-01-01.xlsx", "2026-06-01.xlsx", "2026-10-25.xlsx", "latest.json"],
    });
    const result = await runFullPopulationExport(state.deps, { force: true });
    assert.equal(result, "done");
    assert.equal(state.wasForced(), true);
    assert.equal(state.ready[0], "full/2026-10-25.xlsx");
    assert.equal(state.uploaded.length, 1);
    assert.equal(state.uploaded[0]?.path, "full/2026-10-25.xlsx");
    assert.equal(
      state.uploaded[0]?.type,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.equal(isCompleteXlsx(state.uploaded[0]!.bytes), true);
    const workbook = XLSX.read(state.uploaded[0]!.bytes, { type: "buffer" });
    const sheet = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Data!, {
      header: 1,
    });
    assert.equal(sheet[0]?.[0], "Reg.nr");
    assert.equal(sheet[1]?.[0], "AB1");
    assert.equal(sheet[1]?.[1], "Volvo");
    assert.equal(sheet[1]?.[5], 26000);
    assert.equal(sheet[2]?.[0], "AB2");
    assert.deepEqual(state.stages, ["Henter rader", "Laster opp"]);
    assert.deepEqual(state.removed, [["full/2026-01-01.xlsx"]]);
    assert.equal(state.failed.length, 0);
  });

  it("marks the row failed when the upload never finishes", async () => {
    const state = harness({ claim: "claimed", source: [row("AB1")] });
    state.deps.upload = () => new Promise(() => undefined);
    state.deps.uploadTimeoutMs = 30;
    const result = await runFullPopulationExport(state.deps, { force: true });
    assert.equal(result, "done");
    assert.deepEqual(state.failed, ["Eksporten ble ikke lastet opp i tide."]);
    assert.equal(state.ready.length, 0);
  });

  it("writes the claim error on the snapshot row", async () => {
    const state = harness({ claim: "claimed", source: [row("AB1")] });
    state.deps.claim = async () => {
      throw new Error("duplicate key");
    };
    const result = await runFullPopulationExport(state.deps, { force: true });
    assert.equal(result, "done");
    assert.deepEqual(state.failed, ["Eksporten feilet: duplicate key"]);
    assert.equal(state.uploaded.length, 0);
    assert.equal(state.ready.length, 0);
  });

  it("marks the snapshot failed when the workbook is incomplete", async () => {
    const state = harness({ claim: "claimed", source: [row("AB1")] });
    state.deps.buildWorkbook = () => new Uint8Array([0x50, 0x4b]);
    const result = await runFullPopulationExport(state.deps, { force: true });
    assert.equal(result, "done");
    assert.equal(state.failed[0], "Eksporten ble ufullstendig.");
    assert.equal(state.ready.length, 0);
  });

  it("records a platform abort on the row and does not kill the test process", async () => {
    const calls: number[] = [];
    const detach = attachExportAbortHandler(
      async () => {
        calls.push(1);
      },
      (code) => {
        calls.push(code);
      },
    );
    process.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));
    detach();
    assert.deepEqual(calls, [1, 1]);
  });
});
