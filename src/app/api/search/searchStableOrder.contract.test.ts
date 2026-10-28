import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("public search ranking has deterministic tie breakers for future pages", () => {
  const source = readFileSync("src/app/api/search/route.ts", "utf8");
  assert.match(source, /orderBy: \[\{ boost: "desc" \}, \{ updatedAt: "desc" \}, \{ entityType: "asc" \}, \{ entityId: "asc" \}]/);
  assert.match(source, /Math\.min\(Math\.max\(parseInt\(searchParams\.get\("limit"\)/);
  assert.match(source, /swapKeyboardLayout\(q\)/);
});
