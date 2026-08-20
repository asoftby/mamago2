import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleGallery, type ArticleGalleryImage } from "./ArticleGallery";
import {
  ArticleContentPayloadSchema,
  newBlock,
  parseArticleContentJson,
  serializeArticleContent,
} from "@/lib/publications/articleMvp";

function makeImages(count: number): ArticleGalleryImage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `img-${i}`,
    url: `/api/media/img-${i}`,
    alt: `Фото ${i + 1}`,
    caption: null,
    width: 900,
    height: 1200,
  }));
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// Block schema / editor persistence is untouched by the redesign — presentation is still stored.
for (const presentation of ["carousel", "mosaic", "sequential"] as const) {
  const payload = {
    version: 1 as const,
    blocks: [{ id: presentation, type: "gallery" as const, mediaIds: ["one", "two"], presentation, caption: "Общая подпись" }],
  };
  const parsed = ArticleContentPayloadSchema.parse(serializeArticleContent(payload));
  assert.equal(parsed.blocks[0].type, "gallery");
  assert.equal(parsed.blocks[0].type === "gallery" ? parsed.blocks[0].presentation : null, presentation);
}

const legacy = parseArticleContentJson({ version: 1, blocks: [{ id: "legacy", type: "gallery", mediaIds: ["one"] }] });
assert.equal(legacy.blocks.length, 1, "legacy gallery (no presentation) remains valid");

const newGallery = newBlock("gallery", () => "new-gallery");
assert.equal(newGallery.type === "gallery" ? newGallery.presentation : null, "carousel");

// Empty gallery renders nothing.
assert.equal(renderToStaticMarkup(<ArticleGallery images={[]} />), "");

// 1 image: single slot, no thumbnails, no nav controls.
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(1)} />);
  assert.ok(html.includes(`alt="Фото 1"`), "alt preserved");
  assert.ok(html.includes("grid-cols-1"), "single image uses a 1-col grid");
  assert.ok(!html.includes("Миниатюры изображений"), "no thumbnails for 1 image");
  assert.ok(!html.includes("Предыдущее изображение"), "no prev control for 1 image");
  assert.ok(!html.includes("Следующее изображение"), "no next control for 1 image");
}

// 2 images: 2-col grid, no empty third slot, no thumbnails.
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(2)} />);
  assert.ok(html.includes("grid-cols-2"), "two images use a 2-col grid");
  // 2 in the desktop row + 1 in the (CSS-hidden on desktop) mobile slider markup.
  assert.equal(countOccurrences(html, 'aria-label="Открыть фото'), 3, "2 desktop openable photos + 1 mobile slider trigger");
  assert.ok(!html.includes("Миниатюры изображений"), "no thumbnails for 2 images");
}

// 3 images: 3-col grid, no thumbnails.
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(3)} />);
  assert.ok(html.includes("grid-cols-3"), "three images use a 3-col grid");
  assert.ok(!html.includes("Миниатюры изображений"), "no thumbnails for exactly 3 images");
}

// 4+ images: window of 3 + full thumbnail strip, each thumb targets its own index.
{
  const images = makeImages(7);
  const html = renderToStaticMarkup(<ArticleGallery images={images} />);
  assert.ok(html.includes("grid-cols-3"), "4+ images still show a 3-col window");
  // 3 in the desktop window + 1 in the (CSS-hidden on desktop) mobile slider markup.
  assert.equal(countOccurrences(html, 'aria-label="Открыть фото'), 4, "3 desktop window photos + 1 mobile slider trigger");
  assert.ok(html.includes("Миниатюры изображений"), "thumbnail strip renders for 4+ images");
  for (let i = 0; i < 7; i++) {
    assert.ok(html.includes(`data-thumb-index="${i}"`), `thumbnail ${i} present`);
  }
  assert.ok(html.includes('aria-current="true"'), "active thumbnail is marked current");
}

// Missing media URL falls back to a placeholder instead of crashing.
// Only the mobile branch actually mounts an <Image> in the default (mobile-first) SSR
// render — see the "no double fetch" test below — so the placeholder appears once, not twice.
{
  const html = renderToStaticMarkup(
    <ArticleGallery images={[{ id: "missing", url: null, alt: null, caption: null, width: null, height: null }]} />,
  );
  assert.equal(countOccurrences(html, "Фото недоступно"), 1, "missing image shows exactly one fallback placeholder");
}

// Responsive double-fetch regression guard: the desktop grid and the mobile slider are both
// present in markup (CSS `hidden md:block` / `md:hidden`) for a JS-less/SSR fallback, but only
// one of them may actually mount a real <Image> at a time — otherwise the browser fetches both
// the desktop window images and the mobile slider image regardless of which is visible, since
// `display:none` does not stop image loading. useMediaQuery defaults to "not desktop" during SSR,
// so exactly one <img> (the mobile slider's active photo) should render, never the desktop ones.
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(7)} />);
  assert.equal(countOccurrences(html, "<img"), 1, "only the mobile slider's active photo mounts a real <Image> in the default SSR render");
}

// Gallery-level caption still renders; unset caption never leaks "undefined".
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(2)} caption="Общая подпись" />);
  assert.ok(html.includes("Общая подпись"));
  const noCaptionHtml = renderToStaticMarkup(<ArticleGallery images={makeImages(1)} />);
  assert.ok(!noCaptionHtml.includes("undefined"));
}

// aspect-[9/12] applies uniformly to grid slots.
{
  const html = renderToStaticMarkup(<ArticleGallery images={makeImages(3)} />);
  assert.ok(html.includes("aspect-[9/12]"), "gallery slots use the 9:12 aspect ratio");
}

console.log("article gallery tests: OK");
