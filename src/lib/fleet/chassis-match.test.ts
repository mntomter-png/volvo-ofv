import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

import {
  fleetChassisLabel,
  fleetMatchKeyFromChassis,
  fleetMatchKeyFromVin,
  parseDealerCodes,
} from "@/lib/fleet";
import { parseFleetVinUpload } from "@/lib/fleet/parse-vin-upload";

function workbook(rows: unknown[][], sheetName = "Liste"): ArrayBuffer {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const out = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength,
  ) as ArrayBuffer;
}

describe("chassis- og VIN-nøkkel", () => {
  it("tar siste bokstav i prefikset og seks siffer", () => {
    assert.equal(fleetMatchKeyFromChassis("AA-000001"), "A000001");
    assert.equal(fleetMatchKeyFromChassis("aa 000001"), "A000001");
    assert.equal(fleetMatchKeyFromChassis("BB000002"), "B000002");
    assert.equal(fleetMatchKeyFromChassis("Z-000003"), "Z000003");
    assert.equal(fleetChassisLabel("z 000003"), "Z-000003");
    assert.equal(fleetMatchKeyFromChassis("AA-12345"), null);
    assert.equal(fleetMatchKeyFromChassis(""), null);
  });

  it("matcher VIN-tegn 11 og de siste seks sifrene mot chassis", () => {
    const vin = "YV2RT40A8PB123456";
    assert.equal(vin.length, 17);
    assert.equal(fleetMatchKeyFromVin(vin), "B123456");
    assert.equal(fleetMatchKeyFromChassis("BB-123456"), fleetMatchKeyFromVin(vin));
    assert.notEqual(fleetMatchKeyFromChassis("AA-123456"), fleetMatchKeyFromVin(vin));
    assert.equal(fleetMatchKeyFromVin("YV2RT40A8PZ000003"), "Z000003");
    assert.equal(fleetMatchKeyFromVin("for kort"), null);
    assert.equal(fleetMatchKeyFromVin("YV2RT40A8PB12345A"), null);
  });

  it("leser forhandlernummer fra fritekst", () => {
    assert.deepEqual(parseDealerCodes("896, 890"), ["896", "890"]);
    assert.deepEqual(parseDealerCodes("896 890"), ["896", "890"]);
    assert.equal(parseDealerCodes("  "), null);
  });
});

describe("fleet-opplasting", () => {
  it("beholder chassis for dealer 896 og 890, og slipper inn andre når feltet er tomt", () => {
    const file = workbook([
      ["T-Chassis", "Dealer ID", "Dealer Owner", "Dealer Group"],
      ["AA-000001", 896, "Volvo", "Fleet"],
      ["BB-000002", "890", "Volvo", "Fleet"],
      ["Z-000003", 858, "Volvo", "Region 1"],
      ["AA-12", 896, "Volvo", "Fleet"],
    ]);

    const filtered = parseFleetVinUpload(file);
    assert.deepEqual(filtered.chassis, ["AA-000001", "BB-000002"]);
    assert.equal(filtered.vins.length, 0);
    assert.equal(filtered.skippedDealer, 1);
    assert.equal(filtered.skippedInvalid, 1);
    assert.equal(filtered.dealerFilterApplied, true);
    assert.equal(filtered.source, "chassis_column");

    const allDealers = parseFleetVinUpload(file, { dealerCodes: null });
    assert.deepEqual(allDealers.chassis, ["AA-000001", "BB-000002", "Z-000003"]);
    assert.equal(allDealers.dealerFilterApplied, false);
  });

  it("tar fortsatt imot en ren VIN-fil og en VIN-fil med forhandlerkolonne", () => {
    const vinsOnly = parseFleetVinUpload(
      workbook([["VIN"], ["YV2RT40A8PB123456"], ["YV2RT40A8PB123457"]]),
    );
    assert.deepEqual(vinsOnly.vins, ["YV2RT40A8PB123456", "YV2RT40A8PB123457"]);
    assert.equal(vinsOnly.chassis.length, 0);
    assert.equal(vinsOnly.source, "vin_column");

    const withDealer = parseFleetVinUpload(
      workbook([
        ["VIN", "Dealer number"],
        ["YV2RT40A0RB123456", 896],
        ["YV2RT40A0RB123457", "890"],
        ["YV2RT40A0RB123458", 123],
      ]),
    );
    assert.equal(withDealer.source, "chassis_hierarchy");
    assert.deepEqual(withDealer.vins, [
      "YV2RT40A0RB123456",
      "YV2RT40A0RB123457",
    ]);
    assert.equal(withDealer.skippedDealer, 1);
  });
});

describe("fleet-chassis-migrasjonen", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/migrations/20261102143000_fleet_chassis_match.sql",
    ),
    "utf8",
  );

  it("bygger på #29 og bytter bare VIN-oppslaget", () => {
    assert.equal(sql.includes("ofv_is_competitor_central_deal"), false);
    assert.equal(sql.includes("central_fleet_orgs"), false);
    assert.match(sql, /when 'fleet' then is_fleet_focus/);
    assert.match(sql, /when 'region' then not is_fleet_focus/);
    assert.equal(sql.includes("not is_competitor_central"), false);
    assert.match(sql, /fc\.match_key = r\.fleet_match_key/);
    assert.match(sql, /registrations_fleet_match_key_idx/);
    assert.equal(sql.split("fc.match_key = r.fleet_match_key").length - 1, 12);
    assert.doesNotMatch(sql, /grant execute[\s\S]*?to anon/i);
    assert.match(sql, /revoke all on function public\.replace_fleet_register/);
  });
});
