import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { populationAgeCutoff } from "@/lib/population/filters";
import {
  populationExportPageArgs,
  populationExportStoragePath,
  populationFiltersFromStored,
  populationFiltersToStored,
} from "@/lib/population/export-shared";

const USER = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";

describe("population export filters", () => {
  it("round-trips the filters the population page applies", () => {
    const stored = populationFiltersToStored(
      populationFiltersFromStored({
        make: "Volvo",
        region: "2",
        district: "Oslo",
        hp: "3",
        fuel: "Diesel",
        pabygg: "Distribution",
        bodywork: "-1",
        disp: "0",
        chassis: "trekker",
        age: "under10",
        q: "984 661 185",
        page: "4",
        segment: "Godstransport",
      }),
    );

    assert.equal(stored.make, "Volvo");
    assert.equal(stored.region, "2");
    assert.equal(stored.district, "Oslo");
    assert.equal(stored.bodywork, "-1");
    assert.equal(stored.disp, "0");
    assert.equal(stored.chassis, "trekker");
    assert.equal(stored.age, "under10");
    assert.equal(stored.q, "984661185");
    assert.equal(stored.segment, "Godstransport");
    assert.equal("page" in stored, false);
  });

  it("maps null-codes and the age cutoff into the keyset RPC", () => {
    const now = new Date("2026-10-27T08:00:00.000Z");
    const filters = populationFiltersFromStored({
      make: "Volvo",
      bodywork: "-1",
      disp: "0",
      age: "over10",
      q: "Posten",
    });
    const args = populationExportPageArgs(filters, "2026-10-01", "AB12345", 5000, now);

    assert.equal(args.p_snapshot_date, "2026-10-01");
    assert.equal(args.p_after_registration_number, "AB12345");
    assert.equal(args.p_limit, 1000);
    assert.equal(args.p_make, "Volvo");
    assert.equal(args.p_bodywork, -1);
    assert.equal(args.p_disp, 0);
    assert.equal(args.p_age, "over10");
    assert.equal(args.p_age_cutoff, populationAgeCutoff(now));
    assert.equal(args.p_q, "Posten");
    assert.equal(args.p_region, null);
  });

  it("drops unsafe stored values before they reach SQL", () => {
    const filters = populationFiltersFromStored({
      make: "Volvo",
      q: "%",
      age: "forever",
      bodywork: "999999",
      region: "9",
      extra: "nope",
    });
    const args = populationExportPageArgs(filters, "2026-10-01", null, 10);

    assert.equal(args.p_q, null);
    assert.equal(args.p_age, null);
    assert.equal(args.p_bodywork, null);
    assert.equal(args.p_region, null);
    assert.equal(args.p_make, "Volvo");
    assert.equal(args.p_limit, 10);
    assert.equal(populationFiltersFromStored({ q: "%_Posten%" }).search, "Posten");
  });
});

describe("population export storage path", () => {
  it("keeps the file inside the requesting user's folder", () => {
    assert.equal(
      populationExportStoragePath(USER.toUpperCase(), JOB),
      `${USER}/${JOB}.xlsx`,
    );
  });

  it("rejects path traversal", () => {
    assert.throws(() => populationExportStoragePath(`../${USER}`, JOB));
    assert.throws(() => populationExportStoragePath(USER, `${JOB}/../../other`));
  });
});
