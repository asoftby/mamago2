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

// 1. Photo not in gallery → available for selection.
{
  const currentIds = new Set(["a"]);
  const state = getMediaTileState("b", currentIds, new Set());
  assert.equal(state, "available");
}

// 2. Photo already in gallery → "already-added", regardless of pending selection.
{
  const currentIds = new Set(["a"]);
  assert.equal(getMediaTileState("a", currentIds, new Set()), "already-added");
  // Even if somehow present in pendingSelection too, already-added takes priority.
  assert.equal(getMediaTileState("a", currentIds, new Set(["a"])), "already-added");
}

// 3. Multiple photos: some already added, some newly selected — each resolves independently.
{
  const currentIds = new Set(["existing-1", "existing-2"]);
  const pending = new Set(["new-1"]);
  assert.equal(getMediaTileState("existing-1", currentIds, pending), "already-added");
  assert.equal(getMediaTileState("existing-2", currentIds, pending), "already-added");
  assert.equal(getMediaTileState("new-1", currentIds, pending), "selected");
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
  assert.equal(getMediaTileState("shared-1", currentIds, new Set()), "already-added");
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
  assert.equal(getMediaTileState("b", draftIds, new Set()), "already-added");
}

// 7. Draft removal: after removing a photo from the draft gallery, it becomes
//    available again on next open.
{
  let draftIds = new Set(["a", "b"]);
  assert.equal(getMediaTileState("b", draftIds, new Set()), "already-added");

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

// Regression guards: the "already in gallery" accent state (✓ badge, accent border,
// title) is opt-in per consumer via `alreadyAddedLabel`, never a hardcoded default —
// so a shared-component change for the article gallery can't silently mislabel an
// already-selected tile in a single-image cover field or the business wizard.
{
  const source = readFileSync(new URL("./MediaUploadField.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /title=\{alreadySelected \? "/,
    "the already-added title must come from the alreadyAddedLabel prop, not a hardcoded string",
  );
  assert.match(
    source,
    /showAccentAlready = alreadySelected && Boolean\(alreadyAddedLabel\)/,
    "accent treatment must stay gated on the opt-in alreadyAddedLabel prop",
  );
}
{
  const galleryFieldSource = readFileSync(
    new URL("../admin/articles/ArticleEditorGalleryField.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    galleryFieldSource,
    /alreadyAddedLabel="Уже в галерее"/,
    "the article gallery field is the one consumer that opts into the accent already-added state",
  );
}
for (const [path, label] of [
  ["../admin/articles/ArticleEditorCoverField.tsx", "article cover field (single image, not a gallery)"],
  ["../business/wizard/offer/steps/Step3Media.tsx", "business offer wizard (not the article gallery)"],
] as const) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  assert.doesNotMatch(source, /alreadyAddedLabel=/, `${label} must not opt into the "Уже в галерее" accent state`);
}

console.log("MediaUploadField.test.ts: OK");
