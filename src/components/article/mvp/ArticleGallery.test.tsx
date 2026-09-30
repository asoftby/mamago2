import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleGallery, type ArticleGalleryImage } from "./ArticleGallery";
import { ArticleContentPayloadSchema } from "@/lib/publications/articleMvp";

function image(id: string): ArticleGalleryImage {
  return { id, url: `/api/media/${id}`, alt: id, caption: null, width: 900, height: 1200 };
}

const source = readFileSync(new URL("./ArticleGallery.tsx", import.meta.url), "utf8");
assert.ok(source.includes("data-article-gallery-track"));
assert.ok(source.includes("scroll-smooth") && source.includes("snap-mandatory"));
assert.ok(source.includes("overflow-x-auto") && source.includes("overscroll-x-contain"));
assert.ok(!source.includes("touch-action:pan-y"));
assert.ok(!source.includes("mobileImage") && !source.includes("groupImages"));
assert.ok(source.includes("preloadStart") && source.includes("preloadEnd"));
assert.ok(source.includes("data-gallery-skeleton"));
assert.ok(source.includes("transition-opacity duration-300"));
assert.equal(renderToStaticMarkup(<ArticleGallery images={[]} />), "");

{
  const html = renderToStaticMarkup(<ArticleGallery images={[image("a"), image("a"), image("b"), image("c")]} />);
  assert.equal((html.match(/aria-label="Открыть фото/g) ?? []).length, 3);
  assert.ok(html.includes("Открыть фото 3 из 3"));
  assert.ok(!html.includes("Открыть фото 4"));
}
{
  const html = renderToStaticMarkup(<ArticleGallery images={[image("a"), image("b")]} caption="Подпись" />);
  assert.ok(!html.includes("Предыдущее изображение"));
  assert.ok(html.includes("Следующее изображение"));
  assert.ok(html.includes("1 / 2") && html.includes("Подпись"));
}
for (const presentation of ["carousel", "mosaic", "sequential"] as const) {
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [{ id: presentation, type: "gallery", mediaIds: ["a"], presentation }] }).success, true);
}
assert.ok(source.includes("ArticleGalleryLightbox images={deduplicatedImages}"));
assert.ok(source.includes("data-article-lightbox-slide-viewport"));
assert.ok(source.includes('data-article-lightbox-slide="outgoing"'));
assert.ok(source.includes('data-article-lightbox-slide="incoming"'));
assert.ok(source.includes("duration-[260ms]"));
assert.ok(source.includes('prefers-reduced-motion: reduce'));
assert.ok(source.includes('onClick={(e) => e.stopPropagation()}'));

