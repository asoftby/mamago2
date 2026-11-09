/**
 * Unit tests for useMediaLibraryPager pure helpers.
 *
 * Run: npx tsx src/components/media/useMediaLibraryPager.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS,
  mergeMediaLibraryItems,
  shouldReuseMediaLibrarySnapshot,
} from "./useMediaLibraryPager";

type Item = { id: string; url: string };

function item(id: string): Item {
  return { id, url: `https://example.invalid/${id}` };
}

// Appending a fresh page keeps prior order and appends new items after.
assert.deepEqual(
  mergeMediaLibraryItems([item("a"), item("b")], [item("c"), item("d")]),
  [item("a"), item("b"), item("c"), item("d")],
);

// An id already present (e.g. a race re-delivering the same page) is skipped, not duplicated.
assert.deepEqual(
  mergeMediaLibraryItems([item("a"), item("b")], [item("b"), item("c")]),
  [item("a"), item("b"), item("c")],
);

// Selection-preservation scenario: items selected on page 1 stay first-class members
// of the merged list (same object identity) after page 2 lands — nothing overwrites them.
const page1 = [item("a"), item("b")];
const merged = mergeMediaLibraryItems(page1, [item("c")]);
assert.equal(merged[0], page1[0]);
assert.equal(merged[1], page1[1]);

// Empty next page is a no-op.
assert.deepEqual(mergeMediaLibraryItems([item("a")], []), [item("a")]);

// Empty prev page just adopts the next page verbatim.
assert.deepEqual(mergeMediaLibraryItems([], [item("a"), item("b")]), [item("a"), item("b")]);

const now = 1_000_000;

// Same owner + fresh snapshot + no invalidation: reopen must not hit the loader again.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  true,
);

// Owner switch must never reuse another author's private media snapshot.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-2",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  false,
);

// TTL expiry refreshes the first page so cross-tab changes eventually appear.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  false,
);

// Explicit invalidation after upload forces the next open to refresh immediately.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 3,
  }),
  false,
);

// Null owner keys are normalized to the current-user picker scope.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "__current-user__",
    ownerKey: null,
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 0,
    currentInvalidationVersion: 0,
  }),
  true,
);

// Article cover/gallery must use explicit, user-initiated pagination. The
// general media picker keeps its existing infinite-scroll contract.
const mediaUploadField = readFileSync(new URL("./MediaUploadField.tsx", import.meta.url), "utf8");
const coverField = readFileSync(new URL("../admin/articles/ArticleEditorCoverField.tsx", import.meta.url), "utf8");
const galleryField = readFileSync(new URL("../admin/articles/ArticleEditorGalleryField.tsx", import.meta.url), "utf8");
assert.match(coverField, /libraryPageMode="manual"/);
assert.match(galleryField, /libraryPageMode="manual"/);
assert.match(mediaUploadField, /libraryPageMode === "manual" && libraryHasMore && !libraryLoading/);
assert.match(mediaUploadField, /Подгрузить ещё/);
assert.match(mediaUploadField, /onClick=\{handleLoadMore\} disabled=\{libraryLoadingMore \|\| uploading\}/);
assert.match(mediaUploadField, /libraryPageMode === "automatic" && libraryOpen/);
// The first open loads only article-specific media. The author's first page
// is fetched on tab activation, avoiding an unnecessary request.
const openLibrarySource = mediaUploadField.slice(
  mediaUploadField.indexOf("  const openLibrary = async"),
  mediaUploadField.indexOf("  const handleLoadMore = useCallback"),
);
assert.match(openLibrarySource, /if \(articleLibrary\) \{[\s\S]*?await articleLibrary\.load\(\);[\s\S]*?return;[\s\S]*?await loadLibraryInitial\(\);/);
assert.match(openLibrarySource, /const openAuthorLibrary = \(\) => \{[\s\S]*?void loadLibraryInitial\(\)/);
assert.match(mediaUploadField, /const authorTabLoadedForOwnerRef = useRef<string \| null>\(null\)/);
assert.match(openLibrarySource, /authorTabLoadedForOwnerRef\.current = null/);
assert.match(openLibrarySource, /if \(authorTabLoadedForOwnerRef\.current === owner\) return/);
assert.match(mediaUploadField, /if \(libraryOpenRef\.current && \(!hasArticleLibrary \|\| activeSourceTab === "author"\)\)/);

console.log("useMediaLibraryPager.test.ts: OK");
