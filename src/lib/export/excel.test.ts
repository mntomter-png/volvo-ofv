import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { toExcelBuffer, type ExportColumn } from "@/lib/export/excel";

type Row = { value: string };

const columns: ExportColumn<Row>[] = [
  { header: "Felt", value: (row) => row.value },
];

function firstDataCell(value: string): string {
  const buffer = toExcelBuffer([{ value }], columns);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const cell = sheet?.A2;
  return String(cell?.v ?? "");
}

describe("toExcelBuffer formula sanitization", () => {
  it("prefixes formula-like values so Excel will not execute them", () => {
    assert.equal(firstDataCell("=1+1"), "'=1+1");
    assert.equal(firstDataCell("+cmd"), "'+cmd");
    assert.equal(firstDataCell("-2+2"), "'-2+2");
    assert.equal(firstDataCell("@SUM(A1)"), "'@SUM(A1)");
  });

  it("leaves ordinary text unchanged", () => {
    assert.equal(firstDataCell("Volvo AS"), "Volvo AS");
    assert.equal(firstDataCell("123"), "123");
  });
});

describe("toExcelBuffer", () => {
  it("writes a compressed zip Excel can open", () => {
    const buffer = toExcelBuffer(
      [{ name: "Posten Bring As", formula: "=1+1", dirty: "ok\u0000x" }],
      [
        { header: "Navn", value: (row) => row.name },
        { header: "Formel", value: (row) => row.formula },
        { header: "Tekst", value: (row) => row.dirty },
      ],
    );

    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
    assert.equal(buffer[2], 0x03);
    assert.equal(buffer[3], 0x04);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets.Data;
    assert.ok(sheet);
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
    });
    assert.deepEqual(rows[1], ["Posten Bring As", "'=1+1", "okx"]);
  });
});
