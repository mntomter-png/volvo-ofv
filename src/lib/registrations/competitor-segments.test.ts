import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompetitorSegments,
  focusPositionLabel,
  focusShareHeadline,
  formatSharePoints,
  shareMove,
  type MakeSegmentCount,
} from "@/lib/registrations/competitor-segments";

function row(pabygg: string, make: string, count: number): MakeSegmentCount {
  return { pabygg, make_name: make, count };
}

describe("buildCompetitorSegments", () => {
  it("regner andel, prosentpoeng og delt førsteplass", () => {
    const segments = buildCompetitorSegments(
      [
        row("Construction", "Volvo", 40),
        row("Construction", "Scania", 40),
        row("Construction", "MAN", 20),
      ],
      [
        row("Construction", "Volvo", 30),
        row("Construction", "Scania", 50),
        row("Construction", "MAN", 20),
      ],
      "Volvo",
    );

    assert.equal(segments.length, 1);
    const segment = segments[0]!;
    assert.equal(segment.label, "Anlegg");
    assert.equal(segment.total, 100);
    assert.equal(segment.previousTotal, 100);
    assert.equal(segment.focusCount, 40);
    assert.equal(segment.focusSharePct, 40);
    assert.equal(segment.focusPreviousSharePct, 30);
    assert.equal(segment.focusSharePointDelta, 10);
    assert.equal(segment.focusRank, 1);
    assert.equal(segment.focusTied, true);

    const scania = segment.makes.find((make) => make.make === "Scania");
    assert.equal(scania?.sharePct, 40);
    assert.equal(scania?.sharePointDelta, -10);
    assert.equal(segment.makes[0]?.make, "Scania");
    assert.equal(segment.makes[1]?.make, "Volvo");
  });

  it("holder fokusmerket synlig når det har null i år og hadde volum i fjor", () => {
    const [segment] = buildCompetitorSegments(
      [row("Distribution", "Scania", 10)],
      [
        row("Distribution", "Scania", 6),
        row("Distribution", "Volvo", 4),
      ],
      "Volvo",
    );

    assert.ok(segment);
    assert.equal(segment.focusCount, 0);
    assert.equal(segment.focusRank, null);
    assert.equal(segment.focusSharePct, 0);
    assert.equal(segment.focusPreviousSharePct, 40);
    assert.equal(segment.focusSharePointDelta, -40);
    assert.equal(
      segment.makes.find((make) => make.isFocus)?.make,
      "Volvo",
    );
  });

  it("tar med merker som bare finnes i fjor, og summerer duplikater", () => {
    const [segment] = buildCompetitorSegments(
      [
        row("Long Haul", "Volvo", 10),
        row("Long Haul", "Volvo", 10),
        row("Long Haul", "MAN", 5),
      ],
      [
        row("Long Haul", "Volvo", 10),
        row("Long Haul", "DAF", 10),
      ],
      "Volvo",
    );

    assert.ok(segment);
    assert.equal(segment.total, 25);
    assert.equal(segment.focusCount, 20);
    assert.equal(segment.focusRank, 1);
    assert.equal(segment.focusTied, false);
    const daf = segment.makes.find((make) => make.make === "DAF");
    assert.equal(daf?.count, 0);
    assert.equal(daf?.previousCount, 10);
    assert.equal(daf?.sharePct, 0);
    assert.equal(daf?.previousSharePct, 50);
    assert.equal(daf?.sharePointDelta, -50);
    assert.equal(segment.makes.at(-1)?.make, "DAF");
  });

  it("gir ingen prosentpoeng når fjoråret er tomt", () => {
    const [segment] = buildCompetitorSegments(
      [row("Annet", "Volvo", 4), row("Annet", "Scania", 0)],
      [],
      "Volvo",
    );

    assert.ok(segment);
    assert.equal(segment.label, "Annet");
    assert.equal(segment.focusSharePointDelta, null);
    assert.equal(segment.focusPreviousSharePct, null);
    assert.equal(segment.makes.some((make) => make.make === "Scania"), false);
    assert.equal(
      segment.makes.reduce((sum, make) => sum + make.sharePct, 0),
      100,
    );
  });

  it("sorterer segmentene i påbygg-rekkefølgen og hopper over tomme", () => {
    const segments = buildCompetitorSegments(
      [
        row("Annet", "Volvo", 1),
        row("Long Haul", "Volvo", 1),
        row("Ukjentsegment", "Volvo", 1),
        row("Construction", "Volvo", 0),
      ],
      [row("Distribution", "Scania", 2)],
      "Volvo",
    );

    assert.deepEqual(
      segments.map((segment) => segment.pabygg),
      ["Distribution", "Long Haul", "Annet", "Ukjentsegment"],
    );
    assert.equal(segments[3]?.label, "Ukjentsegment");
  });

  it("ignorerer ugyldige rader", () => {
    assert.deepEqual(
      buildCompetitorSegments(
        [
          row("", "Volvo", 5),
          row("Construction", "", 5),
          { pabygg: "Construction", make_name: "Volvo", count: Number.NaN },
        ],
        [],
        "Volvo",
      ),
      [],
    );
  });
});

describe("andelspoeng", () => {
  it("runder til én desimal og markerer gevinst og tap", () => {
    assert.equal(formatSharePoints(1.24), "+1,2 pp");
    assert.equal(formatSharePoints(1.25), "+1,3 pp");
    assert.equal(formatSharePoints(-0.05), "−0,1 pp");
    assert.equal(formatSharePoints(0.04), "0,0 pp");
    assert.equal(formatSharePoints(null), "—");
    assert.equal(shareMove(0.05), "gain");
    assert.equal(shareMove(-0.05), "loss");
    assert.equal(shareMove(0.04), "flat");
    assert.equal(shareMove(null), "none");
  });

  it("skriver plassering", () => {
    assert.equal(focusPositionLabel(1, false), "1. plass");
    assert.equal(focusPositionLabel(2, true), "delt 2. plass");
    assert.equal(focusPositionLabel(null, false), "Ikke registrert");
  });
});

describe("focusShareHeadline", () => {
  const segments = buildCompetitorSegments(
    [
      row("Construction", "Volvo", 50),
      row("Construction", "Scania", 50),
      row("Distribution", "Volvo", 10),
      row("Distribution", "Scania", 90),
      row("Long Haul", "Volvo", 40),
      row("Long Haul", "Scania", 60),
      row("Annet", "Volvo", 2),
    ],
    [
      row("Construction", "Volvo", 40),
      row("Construction", "Scania", 60),
      row("Distribution", "Volvo", 40),
      row("Distribution", "Scania", 60),
      row("Long Haul", "Volvo", 40),
      row("Long Haul", "Scania", 60),
    ],
    "Volvo",
  );

  it("nevner segmentene der fokusmerket tar og taper andel", () => {
    const headline = focusShareHeadline(segments, "Volvo");
    assert.equal(headline?.tone, "mixed");
    assert.equal(
      headline?.text,
      "Volvo tar andel i Anlegg (+10,0 pp). Taper i Distribusjon (−30,0 pp).",
    );
  });

  it("sier fra når andelen er stabil", () => {
    const stable = buildCompetitorSegments(
      [row("Long Haul", "Volvo", 40), row("Long Haul", "Scania", 60)],
      [row("Long Haul", "Volvo", 40), row("Long Haul", "Scania", 60)],
      "Volvo",
    );
    assert.deepEqual(focusShareHeadline(stable, "Volvo"), {
      text: "Volvo-andelen er stabil mot samme periode i fjor.",
      tone: "flat",
    });
  });

  it("slår sammen flere segment på samme side", () => {
    const headline = focusShareHeadline(
      buildCompetitorSegments(
        [
          row("Construction", "Renault", 20),
          row("Distribution", "Renault", 20),
          row("Long Haul", "Renault", 20),
        ],
        [
          row("Construction", "Renault", 10),
          row("Distribution", "Renault", 10),
          row("Long Haul", "Renault", 10),
          row("Construction", "Volvo", 10),
          row("Distribution", "Volvo", 10),
          row("Long Haul", "Volvo", 10),
        ],
        "Renault",
      ),
      "Renault",
    );
    assert.equal(headline?.tone, "gain");
    assert.equal(
      headline?.text,
      "Renault tar andel i Anlegg (+50,0 pp), Distribusjon (+50,0 pp) og Langtransport (+50,0 pp).",
    );
  });

  it("er tom uten sammenligningsgrunnlag", () => {
    const fresh = buildCompetitorSegments(
      [row("Annet", "Volvo", 3)],
      [],
      "Volvo",
    );
    assert.equal(focusShareHeadline(fresh, "Volvo"), null);
  });
});
