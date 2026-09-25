/**
 * Responsive contract for the Content / Article Editor.
 *
 * Protects the mobile editor decisions from the 2026-09 responsive audit:
 * - isolated editor shell uses the dynamic viewport;
 * - article editor keeps 16/24px gutters and clears the sticky action bar;
 * - primary sticky actions do not rely on horizontal scrolling;
 * - block and rich-text controls expose 44px mobile touch targets;
 * - media controls remain visible on touch devices and fit 320px screens;
 * - media/entity overlays use dynamic viewport constraints and safe areas.
 *
 * Run: pnpm test:responsive-content-editor
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const shell = read("src/app/(content-editor)/layout.tsx");
const articleEditor = read("src/components/admin/articles/ArticleEditorClient.tsx");
const stickyBar = read("src/components/admin/articles/ArticleEditorStickyBar.tsx");
const blocks = read("src/components/admin/articles/ArticleBlocksMvpEditor.tsx");
const richEditor = read("src/components/admin/articles/ArticleBlockRichEditor.tsx");
const media = read("src/components/media/MediaUploadField.tsx");
const entityPicker = read("src/components/admin/articles/ActivityCardEntityPicker.tsx");
const publication = read("src/components/admin/articles/PublicationPanel.tsx");
const seoPanel = read("src/features/admin/seo/components/SeoPanel.tsx");

assert.match(shell, /min-h-dvh/, "Content editor shell must use the dynamic viewport");

assert.match(
  articleEditor,
  /w-full max-w-4xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6/,
  "Article editor must keep the 16/24px mobile gutter contract",
);
assert.match(
  articleEditor,
  /pb-\[calc\(8rem\+env\(safe-area-inset-bottom\)\)\]/,
  "Article editor must reserve room for the mobile sticky action bar",
);
assert.match(
  articleEditor,
  /max-h-\[92dvh\]/,
  "Article editor confirmation dialogs must stay within the dynamic viewport",
);

assert.doesNotMatch(
  stickyBar,
  /overflow-x-auto/,
  "Primary article sticky actions must not require horizontal scrolling",
);
assert.match(
  stickyBar,
  /safe-area-inset-bottom/,
  "Article sticky actions must clear the mobile bottom safe area",
);
assert.match(
  stickyBar,
  /className="h-11 min-w-0 flex-1 px-4 md:h-8/,
  "Article Save/Approve actions must expose 44px mobile targets",
);
assert.ok(
  (stickyBar.match(/className="h-11 w-11 shrink-0[^"]*md:h-8/g) ?? []).length >= 2,
  "Preview and public-link actions must expose compact 44px mobile icon targets",
);

assert.ok(
  (blocks.match(/h-11 w-11 shrink-0[^"]*sm:h-8 sm:w-8/g) ?? []).length >= 3,
  "Block move/delete actions must expose 44px mobile targets",
);
assert.match(
  blocks,
  /min-w-0 flex-1 truncate text-xs font-medium/,
  "Block labels must remain readable beside mobile actions",
);
assert.match(
  blocks,
  /min-h-11 gap-1\.5 font-normal sm:min-h-0/,
  "Block type picker must expose a 44px mobile trigger",
);

assert.match(
  richEditor,
  /overflow-x-auto[^"]*sm:flex-wrap sm:overflow-visible/,
  "Formatting toolbar may scroll horizontally only on mobile",
);
assert.ok(
  (richEditor.match(/h-11 w-11 shrink-0[^"]*sm:h-8 sm:w-8/g) ?? []).length >= 2,
  "Rich-text controls must expose 44px mobile targets",
);
assert.match(
  richEditor,
  /max-h-\[min\(70dvh,32rem\)\]/,
  "Rich-text link editor must fit the dynamic mobile viewport",
);

assert.match(
  media,
  /grid grid-cols-1 gap-3 min-\[360px\]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/,
  "Selected gallery media must stay single-column below 360px, then use 2/3/4 responsive columns",
);
assert.ok(
  (media.match(/h-11 w-11 rounded-full[^"]*sm:h-8 sm:w-8/g) ?? []).length >= 3,
  "Media reorder/delete controls must expose 44px mobile targets",
);
assert.match(
  media,
  /opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100/,
  "Media controls must remain visible without hover on touch screens",
);
assert.match(
  media,
  /h-\[92dvh\] max-h-\[92dvh\]/,
  "Media library must use the dynamic mobile viewport",
);
assert.match(
  media,
  /safe-area-inset-bottom/,
  "Media library footer must clear the bottom safe area",
);
assert.match(
  media,
  /data-slot=dialog-close[^\n]*h-11/,
  "Media dialog close control must be 44px on mobile",
);

assert.match(
  entityPicker,
  /max-h-\[min\(50dvh,280px\)\]/,
  "Entity search results must respect the dynamic mobile viewport",
);
assert.match(
  entityPicker,
  /min-h-11 w-full px-3 py-2 text-left/,
  "Entity search results must expose 44px mobile rows",
);

assert.match(
  publication,
  /CardHeader className="px-4 sm:px-6"/,
  "Publication panel must keep compact mobile card padding",
);
assert.match(
  publication,
  /\[&_button\]:min-h-11 sm:\[&_button\]:min-h-9/,
  "Publication actions must expose 44px mobile targets",
);
assert.match(
  seoPanel,
  /CardContent className="space-y-5 px-4 sm:px-6"/,
  "SEO editor must keep compact mobile card padding",
);

console.log("contentEditorMobileLayoutContract.test.ts: OK");
