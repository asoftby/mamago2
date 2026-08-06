import assert from "node:assert/strict";

import { articleContentBlocksReferenceMediaId } from "./articleContentMediaLinkage";

const MEDIA_ID = "media_1";
const OTHER_MEDIA_ID = "media_2";

function contentWithBlocks(blocks: unknown[]): unknown {
  return { version: 1, blocks };
}

// Regression: inline body images (blocks[].type === "image") must be
// recognized as public linkage — this is the path that was silently 404ing
// for every published Article with inline photos.
assert.equal(
  articleContentBlocksReferenceMediaId(
    contentWithBlocks([
      { id: "b1", type: "image", mediaId: MEDIA_ID, alt: "" },
    ]),
    MEDIA_ID,
  ),
  true,
  "image block referencing the mediaId should match",
);

// Gallery blocks hold multiple ids in `mediaIds`.
assert.equal(
  articleContentBlocksReferenceMediaId(
    contentWithBlocks([
      { id: "b1", type: "gallery", mediaIds: [OTHER_MEDIA_ID, MEDIA_ID] },
    ]),
    MEDIA_ID,
  ),
  true,
  "gallery block whose mediaIds includes the mediaId should match",
);

// No match when the id isn't referenced anywhere.
assert.equal(
  articleContentBlocksReferenceMediaId(
    contentWithBlocks([
      { id: "b1", type: "image", mediaId: OTHER_MEDIA_ID },
      { id: "b2", type: "gallery", mediaIds: [OTHER_MEDIA_ID] },
      { id: "b3", type: "text", text: "hello" },
    ]),
    MEDIA_ID,
  ),
  false,
  "unrelated blocks should not match",
);

// Non-image/gallery blocks (text, quote, heading, activityCard, embed) never match.
assert.equal(
  articleContentBlocksReferenceMediaId(
    contentWithBlocks([
      { id: "b1", type: "intro", text: "lead" },
      { id: "b2", type: "quote", text: "quote" },
      { id: "b3", type: "heading", level: 2, text: "h2" },
      { id: "b4", type: "activityCard", entityType: "EVENT", entityId: "e1" },
      { id: "b5", type: "embed", embedHtml: "<iframe></iframe>" },
    ]),
    MEDIA_ID,
  ),
  false,
  "blocks without a mediaId/mediaIds field should never match",
);

// Malformed / missing contentJson must fail closed (no match), never throw.
assert.equal(
  articleContentBlocksReferenceMediaId(null, MEDIA_ID),
  false,
  "null contentJson should not match",
);
assert.equal(
  articleContentBlocksReferenceMediaId(undefined, MEDIA_ID),
  false,
  "undefined contentJson should not match",
);
assert.equal(
  articleContentBlocksReferenceMediaId({ garbage: true }, MEDIA_ID),
  false,
  "contentJson missing a valid blocks array should not match",
);
assert.equal(
  articleContentBlocksReferenceMediaId(
    contentWithBlocks([{ id: "b1", type: "image" }]),
    MEDIA_ID,
  ),
  false,
  "an image block failing schema validation (missing mediaId) should not match",
);

console.log("articleContentMediaLinkage tests: OK");
