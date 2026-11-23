import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ApiAccessError,
  apiErrorResponse,
} from "@/lib/auth/api-access-core";

function redirectError(destination = "/login"): Error & { digest: string } {
  const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
  error.digest = `NEXT_REDIRECT;replace;${destination};307;`;
  return error;
}

describe("apiErrorResponse", () => {
  it("returns 401 and 403 for ApiAccessError without masking as 500", async () => {
    const unauthorized = apiErrorResponse(
      new ApiAccessError("Ikke innlogget.", 401),
    );
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(await unauthorized.json(), { error: "Ikke innlogget." });

    const forbidden = apiErrorResponse(
      new ApiAccessError("Kontoen mangler gyldig merkevare.", 403),
    );
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), {
      error: "Kontoen mangler gyldig merkevare.",
    });
  });

  it("maps unknown errors to 500, not 401", async () => {
    const previous = console.error;
    console.error = () => {};
    try {
      const response = apiErrorResponse(new Error("boom"));
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: "Intern feil. Prøv igjen senere.",
      });
    } finally {
      console.error = previous;
    }
  });

  it("rethrows Next.js redirect errors", () => {
    const error = redirectError("/ingen-tilgang");
    assert.throws(
      () => apiErrorResponse(error),
      (caught: unknown) => caught === error,
    );
  });
});
