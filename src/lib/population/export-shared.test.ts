import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { populationAgeCutoff } from "@/lib/population/filters";
import {
  FULL_EXPORT_STALE_MS,
  filteredExportUsesDirectResponse,
  fullExportAction,
  fullExportClaimDecision,
  fullExportObjectsToDelete,
  fullPopulationExportPath,
  isSignablePopulationExportPath,
  isUnfilteredPopulationExport,
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

describe("population export delivery", () => {
  it("treats an empty filter set as the prebuilt file", () => {
    const filters = populationFiltersFromStored({});
    assert.equal(isUnfilteredPopulationExport(filters), true);
    assert.equal(
      isUnfilteredPopulationExport(populationFiltersFromStored({ make: "Volvo" })),
      false,
    );
  });

  it("keeps filtered exports direct only under the row cap", () => {
    assert.equal(filteredExportUsesDirectResponse(30_000), true);
    assert.equal(filteredExportUsesDirectResponse(30_001), false);
    assert.equal(filteredExportUsesDirectResponse(null), false);
  });

  it("signs a ready file, waits for a fresh build, and restarts a stale one", () => {
    const now = Date.parse("2026-10-27T08:00:00.000Z");
    assert.equal(
      fullExportAction(
        {
          status: "ready",
          updatedAt: "2026-10-27T07:00:00.000Z",
          storagePath: "full/2026-10-25.xlsx",
        },
        now,
      ),
      "sign",
    );
    assert.equal(
      fullExportAction(
        {
          status: "building",
          updatedAt: "2026-10-27T07:50:00.000Z",
          storagePath: null,
        },
        now,
      ),
      "wait",
    );
    assert.equal(
      fullExportAction(
        {
          status: "building",
          updatedAt: "2026-10-27T07:00:00.000Z",
          storagePath: null,
        },
        now,
      ),
      "start",
    );
    assert.equal(fullExportAction(null, now), "start");
    assert.equal(
      fullExportAction(
        { status: "failed", updatedAt: "2026-10-27T07:59:00.000Z", storagePath: null },
        now,
      ),
      "start",
    );
  });
});

describe("full population export claim", () => {
  const now = Date.parse("2026-10-27T08:00:00.000Z");
  const fresh = new Date(now - 60_000).toISOString();
  const stale = new Date(now - FULL_EXPORT_STALE_MS - 1).toISOString();

  it("takes over a stuck building row, including when force is set", () => {
    const stuck = {
      status: "building",
      updatedAt: stale,
      storagePath: null,
    };
    assert.equal(fullExportClaimDecision(stuck, true, now), "claim");
    assert.equal(fullExportClaimDecision(stuck, false, now), "claim");
    assert.equal(
      fullExportClaimDecision(
        { status: "building", updatedAt: "ikke-en-dato", storagePath: null },
        false,
        now,
      ),
      "claim",
    );
  });

  it("leaves a fresh build alone unless force is set", () => {
    const building = {
      status: "building",
      updatedAt: fresh,
      storagePath: null,
    };
    assert.equal(fullExportClaimDecision(building, false, now), "busy");
    assert.equal(fullExportClaimDecision(building, true, now), "claim");
    assert.equal(
      fullExportClaimDecision(
        {
          status: "ready",
          updatedAt: fresh,
          storagePath: "full/2026-10-25.xlsx",
        },
        false,
        now,
      ),
      "ready",
    );
    assert.equal(
      fullExportClaimDecision(
        {
          status: "ready",
          updatedAt: fresh,
          storagePath: "full/2026-10-25.xlsx",
        },
        true,
        now,
      ),
      "claim",
    );
    assert.equal(fullExportClaimDecision(null, false, now), "claim");
  });
});

describe("full population export objects", () => {
  it("uses a snapshot path and keeps the two newest workbooks", () => {
    assert.equal(fullPopulationExportPath("2026-10-25"), "full/2026-10-25.xlsx");
    assert.throws(() => fullPopulationExportPath("../2026-10-25"));
    assert.deepEqual(
      fullExportObjectsToDelete([
        "latest.json",
        "2026-01-01.xlsx",
        "2026-06-01.xlsx",
        "2026-10-25.xlsx",
        "notes.txt",
      ]),
      ["full/2026-01-01.xlsx"],
    );
    assert.equal(isSignablePopulationExportPath("full/2026-10-25.xlsx"), true);
    assert.equal(isSignablePopulationExportPath("full/latest.json"), false);
    assert.equal(isSignablePopulationExportPath(`${USER}/${JOB}.xlsx`), true);
    assert.equal(isSignablePopulationExportPath("full/../secret.xlsx"), false);
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
