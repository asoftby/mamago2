import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("./businessWorkspace.service.ts", import.meta.url), "utf8");
const notifications = readFileSync(new URL("../notification.service.ts", import.meta.url), "utf8");

assert.match(workspace, /getUserInbox\(params\.userId/);
assert.match(workspace, /stream: "business"/);
assert.match(workspace, /accessibleSurfaces: \["BUSINESS"\]/);
assert.doesNotMatch(workspace, /prisma\.notification\.findMany\(\{\s*where:\s*\{\s*userId: params\.userId/);
assert.match(notifications, /where = mergeStreamFilter\(\{ userId \}, stream\);/);
assert.match(notifications, /where = mergeAccessibleSurfacesFilter\(where, options\.accessibleSurfaces\);/);
assert.match(notifications, /archivedAt: null/);

console.log("businessInbox.contract.test.ts: OK");
