/**
 * Regression coverage for the article editor's dirty-state comparable.
 *
 * Bug: `persistComparableFromSnapshot` (saved-state builder) normalized
 * `authorUserId` as `?? ""`, while the live-form comparable normalized it as
 * `?? null`. For any article without a linked author user (authorUserId ===
 * null, the common case — most articles use a free-text authorLabel instead)
 * this made `dirty` permanently `true` right after a successful save: the
 * two JSON snapshots could never match. A stuck-`true` `dirty` keeps
 * useUnsavedChangesNavigationGuard's document-level click-capture listener
 * registered, which then intercepts clicks on the success modal's own action
 * links (real <a> elements) and opens the "leave without saving" confirmation
 * on top of the still-open success modal — the reported double-popup bug.
 *
 * Fix: both builders now go through the single `buildEditorComparable`
 * normalization function, so this drift class cannot reoccur silently.
 *
 * Run: npx tsx src/lib/article/articleEditorComparable.test.ts
 */
import assert from "node:assert/strict";
import { ContentStatus } from "@prisma/client";
import type { ArticleEditorSnapshot } from "@/lib/article/articleAdminTypes";
import {
  buildEditorComparable,
  buildSavedComparable,
  toLocalDatetimeValue,
} from "@/lib/article/articleEditorComparable";

function baseSnapshot(overrides: Partial<ArticleEditorSnapshot> = {}): ArticleEditorSnapshot {
  return {
    id: "article-1",
    title: "Заголовок статьи",
    slug: "zagolovok-stati",
    subtitle: null,
    excerpt: null,
    content: { version: 1, blocks: [] } as ArticleEditorSnapshot["content"],
    heroImage: null,
    coverImageId: "media-1",
    coverImageUrl: null,
    authorUserId: null,
    authorLabel: "Редакция mamaGo",
    cityContext: null,
    categoryId: "category-1",
    geoScope: "CITY" as ArticleEditorSnapshot["geoScope"],
    cityId: "city-1",
    regionId: null,
    status: ContentStatus.PUBLISHED,
    publishedAt: "2026-08-20T10:00:00.000Z",
    scheduledAt: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoOgImage: null,
    seoImageId: null,
    seoImageUrl: null,
    seoRobots: null,
    noindex: false,
    tagIds: ["tag-1", "tag-2"],
    views: 42,
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Mirrors exactly what `applySnapshot` writes into editor state (and what
 * `currentComparable` then reads back) after a save response is applied —
 * see ArticleEditorClient.tsx's `applySnapshot`.
 */
function currentStateShapeFromSnapshot(snap: ArticleEditorSnapshot) {
  return {
    title: snap.title,
    slug: snap.slug ?? "",
    coverImageId: snap.coverImageId ?? "",
    authorUserId: snap.authorUserId ?? null,
    authorLabel: snap.authorLabel ?? "",
    cityContext: snap.cityContext ?? "",
    categoryId: snap.categoryId ?? null,
    tagIds: snap.tagIds,
    geoScope: snap.geoScope ?? null,
    cityId: snap.cityId ?? null,
    regionId: snap.regionId ?? null,
    content: snap.content,
    status: snap.status,
    publishedAtLocal: toLocalDatetimeValue(snap.publishedAt),
    scheduledAtLocal: toLocalDatetimeValue(snap.scheduledAt),
    seoTitle: snap.seoTitle ?? "",
    seoDescription: snap.seoDescription ?? "",
    seoCanonicalUrl: snap.seoCanonicalUrl ?? "",
    noindex: snap.noindex,
  };
}

// ── Regression: authorUserId === null must not leave dirty stuck true ──────
{
  const snap = baseSnapshot({ authorUserId: null });
  const saved = buildSavedComparable(snap);
  const current = buildEditorComparable(currentStateShapeFromSnapshot(snap));
  assert.equal(
    saved,
    current,
    "after applying a save response with authorUserId=null, saved and current comparables must match (dirty must become false)",
  );
}

// ── Same round trip, with a linked author user (non-null authorUserId) ─────
{
  const snap = baseSnapshot({ authorUserId: "user-42" });
  const saved = buildSavedComparable(snap);
  const current = buildEditorComparable(currentStateShapeFromSnapshot(snap));
  assert.equal(saved, current, "round trip must also match when authorUserId is a real id");
}

// ── Round trip holds across every other nullable field being null too ──────
{
  const snap = baseSnapshot({
    slug: null,
    coverImageId: null,
    authorUserId: null,
    authorLabel: null,
    cityContext: null,
    categoryId: null,
    geoScope: null,
    cityId: null,
    regionId: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    scheduledAt: null,
  });
  const saved = buildSavedComparable(snap);
  const current = buildEditorComparable(currentStateShapeFromSnapshot(snap));
  assert.equal(saved, current, "round trip must match with every nullable field null");
}

// ── A real, unsaved edit must still be detected as dirty ───────────────────
{
  const snap = baseSnapshot({ authorUserId: null });
  const saved = buildSavedComparable(snap);
  const editedState = { ...currentStateShapeFromSnapshot(snap), title: "Изменённый заголовок" };
  const current = buildEditorComparable(editedState);
  assert.notEqual(
    saved,
    current,
    "an actual field change must still produce a different comparable so the leave-confirmation guard keeps firing",
  );
}

// ── Regression: server-normalized seoCanonicalUrl must not leave dirty
// stuck true after save (SeoPanel.tsx used to rebase this value to the
// admin's current browsing origin via sameOriginUrl(window.location.origin)
// instead of the fixed canonical public origin the server actually persists
// via syncArticleCanonical()/absoluteBase() — see SeoPanel.tsx's
// normalizedPublicUrl comment). Simulates: save → server returns a snapshot
// with seoCanonicalUrl already normalized to the app's canonical public
// origin (NEXT_PUBLIC_APP_URL-based, e.g. matching resolveSeoPublicBase()) →
// applyEditorSnapshot writes it into state → persistComparableFromSnapshot
// saves the same snapshot as the baseline → comparables must match.
{
  const snap = baseSnapshot({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/blog/zagolovok-stati",
  });
  const saved = buildSavedComparable(snap);
  const current = buildEditorComparable(currentStateShapeFromSnapshot(snap));
  assert.equal(
    saved,
    current,
    "after applying a save response whose seoCanonicalUrl is the server-normalized canonical origin, saved and current comparables must match (dirty must become false) regardless of what origin the admin is browsing the editor from",
  );
}

// ── The user manually changing seoCanonicalUrl after save must still be
// detected as a real, dirty-worthy edit — this fix must not blunt the
// leave-confirmation guard for genuine changes to this field. ─────────────
{
  const snap = baseSnapshot({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/blog/zagolovok-stati",
  });
  const saved = buildSavedComparable(snap);
  const editedState = {
    ...currentStateShapeFromSnapshot(snap),
    seoCanonicalUrl: "http://mamago.local:3000/minsk/blog/a-different-canonical",
  };
  const current = buildEditorComparable(editedState);
  assert.notEqual(
    saved,
    current,
    "a real, user-made change to seoCanonicalUrl after save must still produce a different comparable so the leave-confirmation guard keeps firing",
  );
}

console.log("articleEditorComparable.test.ts: all assertions passed");
