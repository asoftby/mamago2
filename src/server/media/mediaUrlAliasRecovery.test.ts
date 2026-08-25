import assert from "node:assert/strict";
import { buildAliasRecoveryPlan, countAliasRecoveryPlan } from "./mediaUrlAliasRecovery";

const rows = buildAliasRecoveryPlan({
  rows: [
    { mediaId: "m1", oldUrl: "/api/media/file/old-1.webp" },
    { mediaId: "m1", oldUrl: "/api/media/file/old-2.webp" },
    { mediaId: "m1", oldUrl: "/api/media/file/old-1.webp" },
    { mediaId: "m2", oldUrl: "/api/media/file/conflict.webp" },
    { mediaId: "missing", oldFilename: "old.webp" },
    { mediaId: "m1", oldUrl: "../secret" },
  ],
  assets: [{ id: "m1", publicUrl: "/api/media/file/current.webp" }, { id: "m2", publicUrl: "/api/media/file/current-2.webp" }],
  aliases: [{ mediaId: "other", legacyPath: "conflict.webp" }],
});
assert.deepEqual(rows.map((row) => row.action), ["create", "create", "duplicate", "conflict", "missing-media-asset", "invalid-legacy-path"]);
assert.deepEqual(countAliasRecoveryPlan(rows), {
  aliasesToCreate: 2, alreadyExists: 0, duplicates: 1, conflicts: 1,
  missingMediaAsset: 1, invalidLegacyPath: 1, unresolved: 0, errors: 0,
});
console.log("mediaUrlAliasRecovery.test.ts: OK");
