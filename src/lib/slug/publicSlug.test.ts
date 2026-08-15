/**
 * Run: pnpm exec tsx src/lib/slug/publicSlug.test.ts
 */
import assert from "node:assert/strict";
import {
  buildSlugPreview,
  EmptyPublicationSlugError,
  normalizeSlug,
  normalizeSlugStrict,
  resolveSlugCandidateForSave,
  slugifyTitle,
} from "./publicSlug";

assert.equal(
  slugifyTitle("Самая безопасная игровая в Минске: открытие 21 марта", "article"),
  "samaya-bezopasnaya-igrovaya-v-minske-otkrytie-21-marta",
);

assert.equal(normalizeSlug("  Hello   World!! "), "hello-world");

assert.equal(
  buildSlugPreview({
    title: "Самая безопасная игровая в Минске: открытие 21 марта",
    slug: "",
    wasSlugTouched: false,
    emptyFallback: "article",
  }),
  "samaya-bezopasnaya-igrovaya-v-minske-otkrytie-21-marta",
);

assert.equal(
  buildSlugPreview({
    title: "Другой заголовок",
    slug: "",
    wasSlugTouched: true,
    emptyFallback: "article",
  }),
  "",
);

assert.equal(
  buildSlugPreview({
    title: "Игнор",
    slug: "moy-slug",
    wasSlugTouched: true,
    emptyFallback: "article",
  }),
  "moy-slug",
);

// TITLE RENAME != SLUG RENAME: an already-set slug survives an ordinary
// title edit even when wasSlugTouched is false (i.e. the title field
// changed, not the slug field) — the SEO rule this whole module exists to
// enforce.
assert.equal(
  buildSlugPreview({
    title: "Совершенно новый заголовок после переименования",
    slug: "stable-existing-slug",
    wasSlugTouched: false,
    emptyFallback: "article",
  }),
  "stable-existing-slug",
);

// ── empty after normalization ───────────────────────────────────────────────

assert.equal(normalizeSlugStrict(""), "");
assert.equal(normalizeSlugStrict("   "), "");
assert.equal(normalizeSlugStrict("!!!"), "");
assert.equal(normalizeSlugStrict("---"), "");

assert.throws(
  () =>
    resolveSlugCandidateForSave({
      title: "",
      slugInput: "!!!",
      entityType: "article",
      entityId: "clx1234567890",
      allowIdFallback: false,
    }),
  EmptyPublicationSlugError,
);

assert.throws(
  () =>
    resolveSlugCandidateForSave({
      title: "Без названия",
      slugInput: null,
      entityType: "article",
      entityId: "clx1234567890",
      allowIdFallback: false,
    }),
  EmptyPublicationSlugError,
);

assert.equal(
  resolveSlugCandidateForSave({
    title: "",
    slugInput: null,
    entityType: "article",
    entityId: "clx1234567890",
    allowIdFallback: true,
  }),
  "article-34567890",
);

console.log("✅ publicSlug.test.ts — all assertions passed");
