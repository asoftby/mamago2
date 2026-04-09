import assert from "node:assert";
import { resolveArticleEmbed } from "./articleEmbedSanitize";

const yt = resolveArticleEmbed(
  '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
);
assert.strictEqual(yt.provider, "youtube");
assert.ok(yt.sanitizedHtml.includes("iframe"));
assert.ok(yt.sanitizedHtml.includes("youtube.com/embed"));

const igFrame = resolveArticleEmbed(
  '<iframe src="https://www.instagram.com/p/ABC123xyz01/embed/" height="500" width="500"></iframe>',
);
assert.strictEqual(igFrame.provider, "instagram");
assert.ok(igFrame.sanitizedHtml.includes("instagram.com"));

const bad = resolveArticleEmbed('<script>alert(1)</script><iframe src="https://evil.com/x"></iframe>');
assert.strictEqual(bad.sanitizedHtml, "");
assert.strictEqual(bad.provider, "unknown");

// eslint-disable-next-line no-console
console.log("articleEmbedSanitize OK");
