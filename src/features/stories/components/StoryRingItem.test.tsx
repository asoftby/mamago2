import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { StoryRingItem } from "./StoryRingItem";

const html = renderToStaticMarkup(
  <StoryRingItem
    title="на выходных"
    seen={false}
    onClick={() => {}}
    coverImageUrl="/poster-a.jpg"
    unseenCount={2}
  />,
);

assert.equal((html.match(/<img\b/g) ?? []).length, 1, "date bucket must render exactly one img");
assert.match(html, /object-cover/, "the single cover must fill and crop inside the circle");

const seenHtml = renderToStaticMarkup(
  <StoryRingItem
    title="сегодня"
    seen
    onClick={() => {}}
    coverImageUrl="/poster-seen.jpg"
    unseenCount={0}
  />,
);
assert.equal((seenHtml.match(/<img\b/g) ?? []).length, 1, "seen state must retain the cover");

const fallbackHtml = renderToStaticMarkup(
  <StoryRingItem
    title="завтра"
    seen={false}
    onClick={() => {}}
    coverImageUrl={null}
  />,
);
assert.equal((fallbackHtml.match(/<img\b/g) ?? []).length, 0);
assert.match(fallbackHtml, /from-neutral-100/, "empty bucket images use the neutral fallback");

console.log("StoryRingItem tests: OK");
