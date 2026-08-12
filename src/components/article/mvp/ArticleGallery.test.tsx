import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleGallery, type ArticleGalleryImage } from "./ArticleGallery";
import {
  ArticleContentPayloadSchema,
  LEGACY_ARTICLE_GALLERY_PRESENTATION,
  newBlock,
  parseArticleContentJson,
  serializeArticleContent,
} from "@/lib/publications/articleMvp";

const images: ArticleGalleryImage[] = [
  { id: "one", url: "/api/media/one", alt: "Первое фото", caption: "Первая подпись", width: 1200, height: 800 },
  { id: "two", url: "/api/media/two", alt: "Второе фото", caption: null, width: 800, height: 1200 },
];

for (const presentation of ["carousel", "mosaic", "sequential"] as const) {
  const payload = {
    version: 1 as const,
    blocks: [{ id: presentation, type: "gallery" as const, mediaIds: ["one", "two"], presentation, caption: "Общая подпись" }],
  };
  const parsed = ArticleContentPayloadSchema.parse(serializeArticleContent(payload));
  assert.equal(parsed.blocks[0].type, "gallery");
  assert.equal(parsed.blocks[0].type === "gallery" ? parsed.blocks[0].presentation : null, presentation);

  const html = renderToStaticMarkup(<ArticleGallery images={images} presentation={presentation} caption="Общая подпись" />);
  assert.ok(html.includes(`data-gallery-presentation="${presentation}"`));
  assert.ok(html.includes(`alt="Первое фото"`), `${presentation} preserves alt`);
  assert.ok(html.includes("Первая подпись"), `${presentation} preserves item caption`);
  assert.ok(html.includes("Общая подпись"), `${presentation} preserves gallery caption`);
}

const legacy = parseArticleContentJson({ version: 1, blocks: [{ id: "legacy", type: "gallery", mediaIds: ["one"] }] });
assert.equal(legacy.blocks.length, 1, "legacy gallery remains valid");
assert.equal(legacy.blocks[0].type === "gallery" ? legacy.blocks[0].presentation : null, undefined);
const legacyHtml = renderToStaticMarkup(<ArticleGallery images={images.slice(0, 1)} />);
assert.ok(legacyHtml.includes(`data-gallery-presentation="${LEGACY_ARTICLE_GALLERY_PRESENTATION}"`));
assert.ok(!legacyHtml.includes("Предыдущее изображение"), "one image does not render carousel controls");

const newGallery = newBlock("gallery", () => "new-gallery");
assert.equal(newGallery.type === "gallery" ? newGallery.presentation : null, "carousel");

const incompleteCaptionHtml = renderToStaticMarkup(
  <ArticleGallery images={[{ ...images[0], caption: null }]} presentation="sequential" caption="" />,
);
assert.ok(!incompleteCaptionHtml.includes("undefined"));

console.log("article gallery modes tests: OK");
