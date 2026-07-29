import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleEmbedBlock } from "@/components/article/blocks/ArticleEmbedBlock";
import { parseArticleEmbed } from "./articleEmbedSanitize";

const videoId = "8Dcq9P8l3B8";
const youtubeCases = [
  `https://youtu.be/${videoId}`,
  `https://www.youtube.com/watch?v=${videoId}`,
  `https://youtube.com/watch?v=${videoId}&feature=shared`,
  `https://www.youtube.com/embed/${videoId}`,
  `https://www.youtube.com/shorts/${videoId}`,
  `https://youtu.be/${videoId}?si=ptLcf7_VJYk4nTzb&t=12`,
  `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
];

for (const value of youtubeCases) {
  assert.deepStrictEqual(parseArticleEmbed(value), {
    provider: "youtube",
    videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  });
}

assert.deepStrictEqual(
  parseArticleEmbed(`<iframe src="https://www.youtube.com/embed/${videoId}?feature=oembed"></iframe>`),
  {
    provider: "youtube",
    videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  },
);

const foreignIframe = parseArticleEmbed('<iframe src="https://player.example.com/video/123"></iframe>');
assert.strictEqual(foreignIframe?.provider, "external");
assert.strictEqual(foreignIframe && "url" in foreignIframe ? foreignIframe.url : null, "https://player.example.com/video/123");

assert.strictEqual(parseArticleEmbed("not a URL or embed"), null);
assert.strictEqual(parseArticleEmbed(`https://youtube.com.evil.example/watch?v=${videoId}`)?.provider, "external");
assert.deepStrictEqual(parseArticleEmbed({ embedUrl: `https://youtu.be/${videoId}?si=legacy` }), {
  provider: "youtube",
  videoId,
  embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
});

const rendered = renderToStaticMarkup(
  <ArticleEmbedBlock value={`https://youtu.be/${videoId}?si=public-content-json`} caption="Трейлер статьи" />,
);
assert.ok(rendered.includes(`<iframe`), "stored contentJson URL renders as an iframe");
assert.ok(rendered.includes(`src="https://www.youtube-nocookie.com/embed/${videoId}"`));
assert.ok(rendered.includes(`title="Трейлер статьи"`));
assert.ok(rendered.includes(`loading="lazy"`));
assert.ok(rendered.includes(`allowFullScreen=""`));
assert.ok(rendered.includes(`aspect-video`));
assert.ok(rendered.includes(`Трейлер статьи`), "caption is rendered below the video");
assert.ok(!rendered.includes(`si=public-content-json`), "stored query parameters are not forwarded");

const legacyPublicTextBlockValue = "https://youtu.be/8Dcq9P8l3B8?si=ptLcf7_VJYk4nTzb";
assert.strictEqual(
  parseArticleEmbed(legacyPublicTextBlockValue)?.provider,
  "youtube",
  "standalone YouTube URL already stored in a public Article text block is recognized",
);
assert.strictEqual(
  parseArticleEmbed(`Трейлер: ${legacyPublicTextBlockValue}`),
  null,
  "a YouTube URL inside ordinary prose does not convert the whole text block",
);

const unsafeRendered = renderToStaticMarkup(
  <ArticleEmbedBlock value={'<iframe src="https://evil.example/embed/123"></iframe>'} />,
);
assert.ok(!unsafeRendered.includes("<iframe"), "a foreign iframe is never rendered");
assert.ok(unsafeRendered.includes("Открыть материал"), "safe external URL becomes a link");

console.log("article embed parser and renderer tests: OK");
