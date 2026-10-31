import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import { crc32, createDeflateRaw, deflateRawSync } from "node:zlib";

import {
  spreadsheetCellValue,
  type ExportColumn,
} from "@/lib/export/excel";

/**
 * SheetJS bygger hele regnearket som objekter. For ~49 000 rader målte det
 * omtrent 1,6 GB RSS, over Netlify sin grense på 1 GB, og prosessen ble
 * drept uten at feilen kunne skrives. Denne skriver XML til disk og pakker
 * en komprimert xlsx uten å holde alle cellene i minnet.
 */

const SHEET_OPEN =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
const SHEET_CLOSE = "</sheetData></worksheet>";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;

interface ZipEntry {
  name: string;
  crc: number;
  compressed: Buffer;
  uncompressedSize: number;
}

function columnLetters(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(ref: string, value: string | number): string {
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function rowXml(
  rowNumber: number,
  values: readonly (string | number | null)[],
): string {
  const cells: string[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    cells.push(cellXml(`${columnLetters(index)}${rowNumber}`, value));
  });
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
}

class ByteWriter {
  private pending: Buffer[] = [];
  private pendingBytes = 0;
  crc = 0;
  size = 0;

  constructor(private readonly stream: ReturnType<typeof createWriteStream>) {}

  async push(text: string): Promise<void> {
    const bytes = Buffer.from(text);
    this.pending.push(bytes);
    this.pendingBytes += bytes.length;
    if (this.pendingBytes >= 256 * 1024) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.pendingBytes === 0) return;
    const bytes = Buffer.concat(this.pending, this.pendingBytes);
    this.pending = [];
    this.pendingBytes = 0;
    this.crc = crc32(bytes, this.crc);
    this.size += bytes.length;
    if (!this.stream.write(bytes)) {
      await new Promise<void>((resolve) => this.stream.once("drain", resolve));
    }
  }
}

function zipEntries(entries: readonly ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(entry.crc >>> 0, 14);
    local.writeUInt32LE(entry.compressed.length, 18);
    local.writeUInt32LE(entry.uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, entry.compressed);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(entry.crc >>> 0, 16);
    cd.writeUInt32LE(entry.compressed.length, 20);
    cd.writeUInt32LE(entry.uncompressedSize, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + entry.compressed.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, ...central, eocd]);
}

function entryFromText(name: string, text: string): ZipEntry {
  const data = Buffer.from(text);
  return {
    name,
    crc: crc32(data),
    compressed: deflateRawSync(data),
    uncompressedSize: data.length,
  };
}

async function deflateFile(path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await pipeline(
    createReadStream(path),
    createDeflateRaw(),
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
  );
  return Buffer.concat(chunks);
}

/**
 * Bygger en xlsx ved å skrive én rad av gangen. `writeRows` skal ikke samle
 * alle radene før den returnerer.
 */
export async function buildStreamingXlsx<T>(options: {
  columns: readonly ExportColumn<T>[];
  writeRows: (write: (row: T) => Promise<void>) => Promise<void>;
}): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "population-xlsx-"));
  const sheetPath = join(dir, "sheet.xml");
  try {
    const stream = createWriteStream(sheetPath);
    const writer = new ByteWriter(stream);
    await writer.push(SHEET_OPEN);
    await writer.push(
      rowXml(
        1,
        options.columns.map((column) => column.header),
      ),
    );
    let rowNumber = 2;
    await options.writeRows(async (row) => {
      const values = options.columns.map((column) =>
        spreadsheetCellValue(column.value(row)),
      );
      await writer.push(rowXml(rowNumber, values));
      rowNumber += 1;
    });
    await writer.push(SHEET_CLOSE);
    await writer.flush();
    stream.end();
    await finished(stream);

    const compressedSheet = await deflateFile(sheetPath);
    const sheetStat = await stat(sheetPath);
    if (sheetStat.size !== writer.size) {
      throw new Error("Eksporten ble ufullstendig.");
    }
    return zipEntries([
      entryFromText("[Content_Types].xml", CONTENT_TYPES),
      entryFromText("_rels/.rels", ROOT_RELS),
      entryFromText("xl/workbook.xml", WORKBOOK),
      entryFromText("xl/_rels/workbook.xml.rels", WORKBOOK_RELS),
      entryFromText("xl/styles.xml", STYLES),
      {
        name: "xl/worksheets/sheet1.xml",
        crc: writer.crc,
        compressed: compressedSheet,
        uncompressedSize: writer.size,
      },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
