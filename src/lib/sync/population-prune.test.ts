import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POPULATION_PRUNE_ERROR_PREFIX,
  formatPopulationPruneError,
  isMissingPopulationPruneRpc,
} from "@/lib/sync/population-prune";

describe("formatPopulationPruneError", () => {
  it("prefixer korte feil", () => {
    assert.equal(
      formatPopulationPruneError("canceling statement due to statement timeout"),
      `${POPULATION_PRUNE_ERROR_PREFIX}canceling statement due to statement timeout`,
    );
  });

  it("dublerer ikke prefiks fra watchdog", () => {
    assert.equal(
      formatPopulationPruneError(
        "Populasjonsopprydding: canceling statement due to statement timeout",
      ),
      "Populasjonsopprydding: canceling statement due to statement timeout",
    );
  });

  it("bruker ukjent feil når meldingen er tom", () => {
    assert.equal(
      formatPopulationPruneError("  "),
      `${POPULATION_PRUNE_ERROR_PREFIX}ukjent feil`,
    );
  });

  it("kutter lange meldinger til 500 tegn", () => {
    const formatted = formatPopulationPruneError("x".repeat(800));
    assert.equal(formatted.length, 500);
    assert.equal(formatted.endsWith("..."), true);
    assert.equal(formatted.startsWith(POPULATION_PRUNE_ERROR_PREFIX), true);
  });
});

describe("isMissingPopulationPruneRpc", () => {
  it("gjenkjenner manglende funksjon i schema-cachen", () => {
    assert.equal(isMissingPopulationPruneRpc({ code: "PGRST202" }), true);
    assert.equal(
      isMissingPopulationPruneRpc({
        message:
          "Could not find the function public.prune_surplus_population_snapshots(p_min_rows, p_max_seconds) in the schema cache",
      }),
      true,
    );
  });

  it("slipper gjennom ekte databasefeil", () => {
    assert.equal(
      isMissingPopulationPruneRpc({
        code: "57014",
        message: "canceling statement due to statement timeout",
      }),
      false,
    );
  });
});
