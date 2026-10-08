/**
 * Responsive contract for public media overlays and story modals.
 *
 * Protects the overlay/media fixes from the 2026-09 responsive audit:
 * - gallery/lightbox controls expose 44px mobile touch targets;
 * - lightboxes use dynamic viewport units and clear mobile safe areas;
 * - story navigation and close controls stay touch-safe on mobile;
 * - breaking-news bottom sheet clears both top and bottom safe areas;
 * - article offer embeds do not shrink save actions below the mobile target.
 *
 * Run: pnpm test:responsive-public-overlay
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const articleGallery = read("src/components/article/mvp/ArticleGallery.tsx");
const storyModal = read("src/features/stories/components/StoryModal.tsx");
const storyVisual = read("src/features/stories/components/StoryModalVisual.tsx");
const breakingNews = read("src/features/stories/components/BreakingNewsModal.tsx");
const articleOffer = read("src/components/article/blocks/ArticleOfferEmbed.tsx");

assert.match(
  articleGallery,
  /pt-\[max\(0\.75rem,env\(safe-area-inset-top\)\)\][^"]*pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/,
  "Article lightbox must clear mobile top and bottom safe areas",
);
assert.match(
  articleGallery,
  /h-11 w-11[^"]*sm:h-9 sm:w-9/,
  "Article lightbox close control must expose a 44px mobile target",
);
assert.ok(
  (articleGallery.match(/h-11 w-11[^"]*sm:h-10 sm:w-10/g) ?? []).length >= 2,
  "Article lightbox previous/next controls must expose 44px mobile targets",
);
assert.ok(
  (articleGallery.match(/absolute (?:left|right)-2 top-1\/2 flex h-11 w-11/g) ?? []).length >= 2,
  "Article mobile gallery slider arrows must expose 44px targets",
);
assert.match(
  articleGallery,
  /max-h-\[90dvh\]/,
  "Article lightbox container must use the dynamic viewport",
);
assert.match(
  articleGallery,
  /max-h-\[80dvh\]/,
  "Article lightbox image must use the dynamic viewport",
);

assert.match(
  storyModal,
  /h-11 w-11 md:h-10 md:w-10/,
  "Story modal close action must be 44px on mobile",
);
assert.match(
  storyModal,
  /safe-area-inset-top/,
  "Story modal close action must clear the mobile top safe area",
);
assert.ok(
  (storyVisual.match(/h-11 w-11 md:h-9 md:w-9/g) ?? []).length >= 2,
  "Story previous/next controls must expose 44px mobile targets",
);

assert.match(
  breakingNews,
  /h-11 w-11 md:h-10 md:w-10/,
  "Breaking News close action must be 44px on mobile",
);
assert.match(
  breakingNews,
  /top-\[max\(1rem,env\(safe-area-inset-top\)\)\]/,
  "Breaking News close action must clear the top safe area",
);
assert.match(
  breakingNews,
  /max-md:max-h-\[92dvh\]/,
  "Breaking News sheet must use the dynamic viewport",
);
assert.match(
  breakingNews,
  /pb-\[env\(safe-area-inset-bottom\)\]/,
  "Breaking News list must clear the bottom safe area",
);

assert.match(
  articleOffer,
  /h-11 w-11[^"]*sm:h-9 sm:w-9/,
  "Article offer save action must expose a 44px mobile target",
);
assert.match(
  articleOffer,
  /h-5 w-5 sm:h-4 sm:w-4/,
  "Article offer save icon should scale with the mobile target",
);

console.log("publicOverlayMediaMobileContract.test.ts: OK");
