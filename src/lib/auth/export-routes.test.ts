import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const exportDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../app/api/export",
);

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkRouteFiles(full));
      continue;
    }
    if (entry === "route.ts") files.push(full);
  }
  return files.sort();
}

describe("export API routes", () => {
  const routes = walkRouteFiles(exportDir);

  it("finds the export route handlers", () => {
    assert.ok(routes.length >= 8, `forventet minst 8 ruter, fant ${routes.length}`);
  });

  it("gates every handler with requireApiPageAccess and apiErrorResponse", () => {
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(exportDir, file);
      assert.match(
        src,
        /requireApiPageAccess/,
        `${rel} mangler requireApiPageAccess`,
      );
      assert.match(src, /apiErrorResponse/, `${rel} mangler apiErrorResponse`);
      assert.doesNotMatch(
        src,
        /requirePageAccess/,
        `${rel} bruker requirePageAccess (redirect-felle)`,
      );
    }
  });

  it("rate-limits workbook exports, not the status poll", () => {
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(exportDir, file);
      if (rel === path.join("population", "status", "route.ts")) {
        assert.doesNotMatch(src, /assertExportRateLimit/);
        continue;
      }
      assert.match(
        src,
        /assertExportRateLimit/,
        `${rel} mangler export-rate-limit`,
      );
    }
  });
});
