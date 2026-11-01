import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  displayedHistoryStart,
  HEAVY_REGISTRATION_HISTORY_START,
  isChannelParty,
  isDealerParty,
  isFinanceOrImporter,
  isPlaceholderParty,
  parseExcludeChannel,
} from "./customer-quality";

describe("plassholderkunde", () => {
  it("fjerner Ukjent og tomt navn uten org.nr.", () => {
    assert.equal(isPlaceholderParty("Ukjent", null), true);
    assert.equal(isPlaceholderParty("  ukjent  ", ""), true);
    assert.equal(isPlaceholderParty("", null), true);
    assert.equal(isPlaceholderParty("   ", "  "), true);
  });

  it("beholder kunde med org.nr. eller et ekte navn", () => {
    assert.equal(isPlaceholderParty("Ukjent", "999888777"), false);
    assert.equal(isPlaceholderParty(null, "123"), false);
    assert.equal(isPlaceholderParty("Ukjent Transport AS", null), false);
    assert.equal(isPlaceholderParty("Tine SA", null), false);
  });
});

describe("finans og importør", () => {
  it("treffer finans og kjente importører", () => {
    for (const name of [
      "Traton Finans AB NUF",
      "Volvo Finans Norge AS",
      "DNB Finans",
      "Ayvens Norge AS",
      "Nordea Finans Norge AS",
      "Volvo Norge AS",
      "Volvo Maskin AS",
      "Norsk Scania AS",
      "MAN Truck & Bus Norge AS",
      "Bertel O. Steen Trucks & Buses AS",
    ]) {
      assert.equal(isFinanceOrImporter(name), true, name);
    }
  });

  it("slipper holdingselskap og driftsselskaper", () => {
    for (const name of [
      "Kapital-styring AS",
      "S Solem Kapital AS",
      "Volvo Holding AS",
      "Tine SA",
      "Nor-log AS",
      "Posten Bring Bildrift AS",
    ]) {
      assert.equal(isFinanceOrImporter(name), false, name);
    }
  });
});

describe("forhandler og kanal", () => {
  it("treffer forhandlerne som fyller toppkjøperlisten", () => {
    assert.equal(isDealerParty("Nordren AS"), true);
    assert.equal(isDealerParty("Holtan Bil AS"), true);
    assert.equal(isDealerParty("Trucknor AS Avd Bergen Salg"), true);
    assert.equal(isDealerParty("Bertel O. Steen Lastebil Og Buss AS"), true);
    assert.equal(isChannelParty("Nordren AS"), true);
    assert.equal(isChannelParty("Volvo Norge AS"), true);
    assert.equal(isChannelParty("Traton Finans AB NUF"), true);
  });

  it("slipper transportkunder med bil i navnet", () => {
    for (const name of [
      "AS Torpa Bilruter",
      "Posten Bring Bildrift AS",
      "Skevig Lastebiltransport AS",
      "Pluss Truck Sales & Rentals AS",
      "Tine SA",
      "Nor-log AS",
    ]) {
      assert.equal(isDealerParty(name), false, name);
      assert.equal(isChannelParty(name), false, name);
    }
  });
});

describe("visning og toggle", () => {
  it("klemmer lookback før 2020", () => {
    assert.equal(
      displayedHistoryStart("2016-11-01"),
      HEAVY_REGISTRATION_HISTORY_START,
    );
    assert.equal(displayedHistoryStart("2024-01-01"), "2024-01-01");
  });

  it("skjuler kanal som default og viser den ved 0", () => {
    assert.equal(parseExcludeChannel(undefined), true);
    assert.equal(parseExcludeChannel("1"), true);
    assert.equal(parseExcludeChannel("0"), false);
    assert.equal(parseExcludeChannel("false"), false);
    assert.equal(parseExcludeChannel(["1", "0"]), false);
  });
});

describe("migrasjonen speiler reglene", () => {
  const sql = readFileSync(
    new URL(
      "../../../supabase/migrations/20261101134855_customer_party_quality.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("bruker felles motorfilter og bruker som kunde i Kundeutvikling", () => {
    assert.ok(sql.split("ofv_disp_matches(").length > 8);
    assert.equal(sql.toLowerCase().includes("kapital"), false);
    assert.match(sql, /primary_user_orgnr/);
    assert.match(sql, /ofv_is_finance_or_importer/);
    assert.match(sql, /p_exclude_channel boolean default false/);
  });

  it("setter search_path og gir ikke anon execute", () => {
    assert.match(sql, /set search_path = public/);
    assert.match(sql, /revoke all on function %s from public, anon/);
    assert.equal(sql.includes("to anon"), false);
    assert.match(sql, /grant execute on function %s to authenticated/);
  });

  it("returnerer totale potensialtall utenfor topp 200", () => {
    assert.match(sql, /total_accounts int/);
    assert.match(sql, /count\(\*\) over \(\)::int/);
    assert.match(sql, /untapped_count int/);
  });
});
