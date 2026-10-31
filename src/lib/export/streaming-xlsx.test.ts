import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { buildStreamingXlsx } from "@/lib/export/streaming-xlsx";
import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";

describe("buildStreamingXlsx", () => {
  it("writes a workbook Excel can open, including escaped text", async () => {
    const bytes = await buildStreamingXlsx<{ name: string; kg: number | null }>({
      columns: [
        { header: "Navn", value: (row) => row.name },
        { header: "Kg", value: (row) => row.kg },
      ],
      writeRows: async (write) => {
        await write({ name: "A & B", kg: 26000 });
        await write({ name: "=1+1", kg: null });
      },
    });
    assert.equal(isCompleteXlsx(bytes), true);
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Data!, {
      header: 1,
    });
    assert.deepEqual(rows[0], ["Navn", "Kg"]);
    assert.equal(rows[1]?.[0], "A & B");
    assert.equal(rows[1]?.[1], 26000);
    assert.equal(rows[2]?.[0], "'=1+1");
    assert.equal(rows[2]?.[1], undefined);
  });
});
