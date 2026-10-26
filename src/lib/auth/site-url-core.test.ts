import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAuthCallbackUrl,
  resolveAuthOrigin,
  resolveServerSiteUrl,
} from "@/lib/auth/site-url-core";

const CANONICAL = "https://app.biloversikt.com";

describe("resolveServerSiteUrl", () => {
  it("requires SITE_URL in production", () => {
    assert.throws(
      () =>
        resolveServerSiteUrl({
          NODE_ENV: "production",
          NEXT_PUBLIC_SITE_URL: CANONICAL,
        }),
      /SITE_URL må være satt/,
    );
  });

  it("returns SITE_URL in production even if NEXT_PUBLIC differs", () => {
    assert.equal(
      resolveServerSiteUrl({
        NODE_ENV: "production",
        SITE_URL: `${CANONICAL}/`,
        NEXT_PUBLIC_SITE_URL: "https://evil.example",
      }),
      CANONICAL,
    );
  });

  it("allows NEXT_PUBLIC or localhost fallback outside production", () => {
    assert.equal(
      resolveServerSiteUrl({
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3001/",
      }),
      "http://localhost:3001",
    );
    assert.equal(
      resolveServerSiteUrl({ NODE_ENV: "development" }),
      "http://localhost:3000",
    );
  });
});

describe("buildAuthCallbackUrl", () => {
  it("uses /auth/confirm with encoded next", () => {
    assert.equal(
      buildAuthCallbackUrl(CANONICAL),
      `${CANONICAL}/auth/confirm?next=%2Foppdater-passord`,
    );
    assert.equal(
      buildAuthCallbackUrl(CANONICAL, "/admin/sikkerhet"),
      `${CANONICAL}/auth/confirm?next=%2Fadmin%2Fsikkerhet`,
    );
  });
});

describe("resolveAuthOrigin", () => {
  it("does not fall back to request Host in production", () => {
    assert.throws(
      () =>
        resolveAuthOrigin(
          { NODE_ENV: "production" },
          "https://evil.example/auth/confirm",
        ),
      /SITE_URL må være satt/,
    );
  });

  it("uses SITE_URL in production", () => {
    assert.equal(
      resolveAuthOrigin(
        { NODE_ENV: "production", SITE_URL: CANONICAL },
        "https://volvo-ofv.netlify.app/auth/confirm",
      ),
      CANONICAL,
    );
  });

  it("falls back to request origin only outside production", () => {
    assert.equal(
      resolveAuthOrigin(
        { NODE_ENV: "development" },
        "http://localhost:3000/auth/confirm",
      ),
      "http://localhost:3000",
    );
  });
});
