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

console.log("StoryRingItem tests: OK");
