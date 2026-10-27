import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { toExcelBuffer, type ExportColumn } from "@/lib/export/excel";
import {
  isCompleteXlsx,
  SYNC_XLSX_RESPONSE_LIMIT_BYTES,
} from "@/lib/export/xlsx-bytes";

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

describe("full population workbook vs Netlify 6 MB", () => {
  it("is a complete zip larger than the synchronous response limit", () => {
    const rows = Array.from({ length: 65_575 }, (_, index) => ({
      registrationNumber: `EL${String(index).padStart(5, "0")}`,
      make: ["Volvo", "Scania", "Mercedes-Benz", "MAN", "DAF"][index % 5],
      model: index % 7 === 0 ? "FH 540" : "R 450",
      variant: "6x2 Trekkvogn",
      usage: "Godstransport",
      mass: 18_000 + (index % 20) * 500,
      registered: "2016-03-14",
      status: "Registrert",
      owner: `Eier ÆØÅ ${index % 400} AS`,
      ownerPost: String(1000 + (index % 8000)).padStart(4, "0"),
      ownerPlace: "Oslo",
      user: `Bruker ${index % 900} Transport`,
      userPost: String(2000 + (index % 7000)).padStart(4, "0"),
      userPlace: "Bergen",
    }));

    const buffer = toExcelBuffer(rows, [
      { header: "Reg.nr", value: (row) => row.registrationNumber },
      { header: "Merke", value: (row) => row.make },
      { header: "Modell", value: (row) => row.model },
      { header: "Variant", value: (row) => row.variant },
      { header: "OFV Usage", value: (row) => row.usage },
      { header: "Totalvekt (kg)", value: (row) => row.mass },
      { header: "Først registrert", value: (row) => row.registered },
      { header: "Status", value: (row) => row.status },
      { header: "Eier", value: (row) => row.owner },
      { header: "Eier postnr", value: (row) => row.ownerPost },
      { header: "Eier poststed", value: (row) => row.ownerPlace },
      { header: "Bruker", value: (row) => row.user },
      { header: "Bruker postnr", value: (row) => row.userPost },
      { header: "Bruker poststed", value: (row) => row.userPlace },
    ]);

    assert.ok(buffer.length > SYNC_XLSX_RESPONSE_LIMIT_BYTES);
    assert.equal(isCompleteXlsx(buffer), true);

    const truncated = buffer.subarray(0, SYNC_XLSX_RESPONSE_LIMIT_BYTES);
    assert.equal(truncated[0], 0x50);
    assert.equal(truncated[1], 0x4b);
    assert.equal(isCompleteXlsx(truncated), false);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets.Data;
    assert.equal(sheet?.["!ref"], "A1:N65576");
  });
});
