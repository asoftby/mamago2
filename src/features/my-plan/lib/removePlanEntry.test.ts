import assert from "node:assert/strict";
import { removePlanEntryRequest } from "./removePlanEntry";

const manual = removePlanEntryRequest({ id: "note", source: "MANUAL", updatedAt: "2026-10-19T09:00:00.000Z" });
assert.equal(manual.url, "/api/plan/manual/note");
assert.equal(manual.init.method, "DELETE");
assert.deepEqual(JSON.parse(String(manual.init.body)), { expectedUpdatedAt: "2026-10-19T09:00:00.000Z" });
const catalog = removePlanEntryRequest({ id: "activity /1", source: "CATALOG" });
assert.equal(catalog.url, "/api/save/plan?planItemId=activity%20%2F1");
assert.equal(catalog.init.method, "DELETE");
console.log("removePlanEntry: OK");
