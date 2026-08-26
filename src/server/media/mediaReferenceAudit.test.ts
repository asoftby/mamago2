import assert from "node:assert/strict";
import { buildMediaAssetReferenceResolver } from "./mediaReferenceAudit";

const resolve = buildMediaAssetReferenceResolver([
  { id: "media-1", publicUrl: "/api/media/file/folder/photo.webp", storageKey: "/api/media/file/folder/photo.webp", filename: "photo.webp" },
  { id: "media-2", publicUrl: "/api/media/file/other.webp", storageKey: "/api/media/file/other.webp", filename: "other.webp" },
]);
assert.deepEqual(resolve("media-1"), { mediaId: "media-1" });
assert.deepEqual(resolve("/api/media/file/folder/photo.webp"), { mediaId: "media-1" });
assert.deepEqual(resolve("/uploads/folder/photo.webp"), { mediaId: "media-1" });
assert.deepEqual(resolve("other.webp"), { mediaId: "media-2" });
assert.deepEqual(resolve("/uploads/missing.webp"), { mediaId: null, reason: "media-asset-not-found" });
console.log("mediaReferenceAudit.test.ts: OK");
