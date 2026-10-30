import assert from "node:assert/strict";

import { decodeHtmlEntities, extractLinkPreview, isProvisionalTitle } from "./linkPreviewPure";

const page = "https://shop.example.test/p/lego-42?x=1";

// og tags, either attribute order, entities, relative image
{
  const html = `<html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="LEGO &quot;City&quot; 42">
    <meta content="/img/lego.jpg" property="og:image">
    <meta name="description" content="Набор   для
      детей">
    <meta property="og:site_name" content="Shop">
  </head></html>`;
  const p = extractLinkPreview(html, page);
  assert.equal(p.title, 'LEGO "City" 42');
  assert.equal(p.imageUrl, "https://shop.example.test/img/lego.jpg");
  assert.equal(p.description, "Набор для детей");
  assert.equal(p.siteName, "Shop");
}

// falls back to <title>; no image
{
  const p = extractLinkPreview("<title>  Just  a title </title>", page);
  assert.equal(p.title, "Just a title");
  assert.equal(p.imageUrl, null);
}

// hostile / unusable values are dropped
assert.equal(extractLinkPreview('<meta property="og:image" content="javascript:alert(1)">', page).imageUrl, null);
assert.equal(extractLinkPreview('<meta property="og:image" content="data:image/png;base64,AAAA">', page).imageUrl, null);
assert.equal(extractLinkPreview('<meta property="og:image" content="https://u:p@evil.test/a.jpg">', page).imageUrl, null);
assert.equal(extractLinkPreview("", page).title, null);

// title is capped; control chars from numeric entities are dropped
assert.ok((extractLinkPreview(`<title>${"a".repeat(500)}</title>`, page).title ?? "").length <= 200);
assert.equal(decodeHtmlEntities("a&#0;b&#x7;c&#65;"), "abcA");

// provisional title detection
assert.equal(isProvisionalTitle("shop.example.test", "https://www.shop.example.test/p/1"), true, "www prefix is ignored");
assert.equal(isProvisionalTitle("example.test", "https://www.example.test/p/1"), true);
assert.equal(isProvisionalTitle("LEGO 42", "https://www.example.test/p/1"), false);
assert.equal(isProvisionalTitle("https://x.test/a", "https://x.test/a"), true);

console.log("linkPreviewPure ok");
