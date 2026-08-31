import assert from "node:assert/strict";

import { getDefaultLlmsTxtContent } from "./llms-default";

// --- llms.txt default content must be valid Markdown with exactly one H1
// and only link to routes that actually exist as production pages (not just
// detail-page directories like /[city]/places/[slug] with no bare listing). ---

const content = getDefaultLlmsTxtContent();
const lines = content.split("\n");

// --- 1. exactly one H1 ---

{
  const h1Lines = lines.filter((l) => /^#\s/.test(l));
  assert.equal(h1Lines.length, 1, `expected exactly one H1, found ${h1Lines.length}`);
  assert.ok(h1Lines[0].startsWith("# "), "H1 must use '# ' markdown syntax");
}

// --- 2. at least one absolute markdown link to mamago.by ---

const linkPattern = /\[([^\]]+)\]\((https:\/\/mamago\.by[^\s)]*)\)/g;
const links = [...content.matchAll(linkPattern)].map((m) => m[2]);

{
  assert.ok(links.length >= 1, "expected at least one absolute mamago.by markdown link");
}

// --- 3. no dead-end city listing links: /[city]/places and /[city]/offers
// only exist as detail routes ([slug]), not bare listings, in the current
// route table (see src/app/(public)/[city]/{places,offers}). ---

{
  const deadListingPaths = [/^https:\/\/mamago\.by\/[^/]+\/places\/?$/, /^https:\/\/mamago\.by\/[^/]+\/offers\/?$/];
  for (const url of links) {
    for (const pattern of deadListingPaths) {
      assert.ok(!pattern.test(url), `llms.txt must not link to a non-existent listing page: ${url}`);
    }
  }
}

// --- 4. every linked path resolves to a route that actually exists in this
// app (bare-city, city/events, city/classes, city/routes, city/blog, or the
// top-level /blog and root domain). Extend this list if a real route is
// added; never add a link here without an existing page.tsx behind it. ---

{
  const knownPaths = new Set([
    "/minsk",
    "/minsk/events",
    "/minsk/classes",
    "/minsk/routes",
    "/blog",
    "/",
  ]);
  for (const url of links) {
    const path = url.replace(/^https:\/\/mamago\.by/, "") || "/";
    assert.ok(knownPaths.has(path), `llms.txt links to an unlisted/unverified path: ${path}`);
  }
}

console.log("llms-default content test: OK");
