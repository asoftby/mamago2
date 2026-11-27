import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("public search ranking has deterministic tie breakers for future pages", () => {
  const source = readFileSync("src/app/api/search/route.ts", "utf8");
  assert.match(source, /const orderBy = \[\{ boost: "desc" \}, \{ updatedAt: "desc" \}, \{ entityType: "asc" \}, \{ entityId: "asc" \}]/);
  assert.match(source, /Number\.isFinite\(rawLimit\)/);
  assert.match(source, /swapKeyboardLayout\(q\)/);
});

test("public search applies stable ordering to database queries", () => {
  const source = readFileSync(
    "src/app/api/search/route.ts", "utf8"
  );
  assert.match(source, /orderBy:\s*\[\.\.\.orderBy\]/);
});
