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
