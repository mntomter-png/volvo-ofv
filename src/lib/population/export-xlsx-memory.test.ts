import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

describe("full population workbook memory", () => {
  it("stays under the Netlify background function limit for 20 000 rows", () => {
    const script = path.join(
      process.cwd(),
      "src/lib/population/export-xlsx-memory-child.ts",
    );
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "minnesjekk feilet",
    );
    const line = result.stdout.trim().split("\n").at(-1) ?? "";
    const measured = JSON.parse(line) as { peakRssMb: number; rows: number };
    assert.equal(measured.rows, 20_000);
    assert.ok(measured.peakRssMb > 0, "mangler VmHWM");
    // SheetJS brukte omtrent 1,6 GB på hele bestanden. Bakgrunnsfunksjonen har 1 GB.
    assert.ok(
      measured.peakRssMb < 400,
      `topp RSS ${measured.peakRssMb} MB`,
    );
  });
});
