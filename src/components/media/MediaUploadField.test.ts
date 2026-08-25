/**
 * Unit tests for the media-picker "already added" logic used by the
 * article gallery/cover dialog (MediaUploadField): tile state resolution
 * by stable media id, and dedupe-on-add when confirming the selection.
 *
 * Run: npx tsx src/components/media/MediaUploadField.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMediaTileState, mergeNewLibrarySelection, type MediaUploadItem } from "./MediaUploadField";

function item(id: string, overrides: Partial<MediaUploadItem> = {}): MediaUploadItem {
  return { id, url: `https://example.invalid/${id}.jpg`, alt: null, title: null, ...overrides };
}

// Used in another block remains selectable; pending selection wins visually.
{
  const usedIds = new Set(["shared"]);
  assert.equal(getMediaTileState("shared", new Set(), new Set(), usedIds.has("shared")), "used-elsewhere");
  assert.equal(getMediaTileState("shared", new Set(), new Set(["shared"]), usedIds.has("shared")), "pending-selection");
  const merged = mergeNewLibrarySelection([], [item("shared")], new Set(["shared"]), 24);
  assert.deepEqual(merged.map((entry) => entry.id), ["shared"]);
}

// 1. Photo not in gallery → available for selection.
{
  const currentIds = new Set(["a"]);
  const state = getMediaTileState("b", currentIds, new Set());
  assert.equal(state, "available");
}

// 2. Photo already in gallery → "already-added", regardless of pending selection.
{
  const currentIds = new Set(["a"]);
  assert.equal(getMediaTileState("a", currentIds, new Set()), "selected-in-current-field");
  // Even if somehow present in pendingSelection too, already-added takes priority.
  assert.equal(getMediaTileState("a", currentIds, new Set(["a"])), "selected-in-current-field");
}

// 3. Multiple photos: some already added, some newly selected — each resolves independently.
{
  const currentIds = new Set(["existing-1", "existing-2"]);
  const pending = new Set(["new-1"]);
  assert.equal(getMediaTileState("existing-1", currentIds, pending, true), "selected-in-current-field");
  assert.equal(getMediaTileState("existing-2", currentIds, pending), "selected-in-current-field");
  assert.equal(getMediaTileState("new-1", currentIds, pending), "pending-selection");
  assert.equal(getMediaTileState("new-2", currentIds, pending), "available");
}

// 4a. "Добавить в галерею" adds only the new selected ids, in candidate-source order,
//     appended after the existing gallery items.
{
  const current = [item("existing-1")];
  const candidateSource = [item("existing-1"), item("new-1"), item("new-2")];
  const selectedIds = new Set(["new-1", "new-2"]);
  const merged = mergeNewLibrarySelection(current, candidateSource, selectedIds, 24);
  assert.deepEqual(
    merged.map((i) => i.id),
    ["existing-1", "new-1", "new-2"],
  );
}

// 4b. Existing images are never re-added even if their id ends up in selectedIds
//     (defense in depth beyond the click guard that prevents selecting them at all).
{
  const current = [item("existing-1")];
  const candidateSource = [item("existing-1"), item("new-1")];
  const selectedIds = new Set(["existing-1", "new-1"]);
  const merged = mergeNewLibrarySelection(current, candidateSource, selectedIds, 24);
  assert.deepEqual(
    merged.map((i) => i.id),
    ["existing-1", "new-1"],
    "existing-1 appears exactly once, not duplicated",
  );
}

// 5. Same media item present in both "Фото этой статьи" and "Медиатека автора"
//    (duplicate entries in candidateSource) — resolved once, no duplicate insert.
{
  const current: MediaUploadItem[] = [];
  const articleTabItem = item("shared-1", { title: "From article tab" });
  const authorTabItem = item("shared-1", { title: "From author tab" });
  const candidateSource = [articleTabItem, authorTabItem, item("new-1")];
  const selectedIds = new Set(["shared-1", "new-1"]);
  const merged = mergeNewLibrarySelection(current, candidateSource, selectedIds, 24);
  assert.deepEqual(
    merged.map((i) => i.id),
    ["shared-1", "new-1"],
  );

  // And getMediaTileState is consistent for the same id regardless of which tab renders it.
  const currentIds = new Set(merged.map((i) => i.id));
  assert.equal(getMediaTileState("shared-1", currentIds, new Set()), "selected-in-current-field");
}

// 6. Draft: after adding a photo, currentIds reflects the live draft gallery
//    (getMediaTileState is a pure function of the value passed in — no separate
//    cached source — so the caller re-deriving currentIds from the updated draft
//    value is all that's needed for the picker to see it as already-added).
{
  let draftIds = new Set(["a"]);
  assert.equal(getMediaTileState("b", draftIds, new Set()), "available");

  // Simulate: user added "b" to the draft gallery via the dialog.
  draftIds = new Set([...draftIds, "b"]);
  assert.equal(getMediaTileState("b", draftIds, new Set()), "selected-in-current-field");
}

// 7. Draft removal: after removing a photo from the draft gallery, it becomes
//    available again on next open.
{
  let draftIds = new Set(["a", "b"]);
  assert.equal(getMediaTileState("b", draftIds, new Set()), "selected-in-current-field");

  // Simulate: user removed "b" from the draft gallery.
  draftIds = new Set([...draftIds].filter((id) => id !== "b"));
  assert.equal(getMediaTileState("b", draftIds, new Set()), "available");
}

// maxFiles cap is still respected after merging.
{
  const current = [item("existing-1")];
  const candidateSource = [item("new-1"), item("new-2"), item("new-3")];
  const selectedIds = new Set(["new-1", "new-2", "new-3"]);
  const merged = mergeNewLibrarySelection(current, candidateSource, selectedIds, 2);
  assert.equal(merged.length, 2);
}

// Usage awareness is opt-in; without usedIds persisted metadata is ignored and
// the generic component retains its old selected/available behavior.
{
  const source = readFileSync(new URL("./MediaUploadField.tsx", import.meta.url), "utf8");
  assert.match(source, /const usageAware = usedIds !== undefined/);
  assert.equal(getMediaTileState("used", new Set(), new Set(), true), "used-elsewhere");
  assert.equal(getMediaTileState("used", new Set(), new Set()), "available");
  assert.equal(getMediaTileState("used", new Set(), new Set(["used"]), true), "pending-selection");
}
{
  const galleryFieldSource = readFileSync(
    new URL("../admin/articles/ArticleEditorGalleryField.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    galleryFieldSource,
    /usedIds=\{articleMediaSource\?\.usedIds\}/,
    "article gallery must opt into live usage awareness",
  );
}
for (const [path, label] of [
  ["../admin/articles/ArticleEditorCoverField.tsx", "article cover field (single image, not a gallery)"],
  ["../business/wizard/offer/steps/Step3Media.tsx", "business offer wizard (not the article gallery)"],
] as const) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  assert.doesNotMatch(source, /alreadyAddedLabel=/, `${label} must not use the removed destination-specific contract`);
}

console.log("MediaUploadField.test.ts: OK");
