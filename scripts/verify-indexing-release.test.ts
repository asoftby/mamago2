import assert from "node:assert/strict";
import {
  extractCanonical,
  extractRobotsMeta,
  extractSitemapUrls,
  hasNoindexDirective,
} from "./verify-indexing-release";

assert.deepEqual(
  extractSitemapUrls(
    `<urlset><url><loc>https://mamago.by/minsk</loc></url><url><loc>https://mamago.by/blog</loc></url></urlset>`,
  ),
  ["https://mamago.by/minsk", "https://mamago.by/blog"],
);

assert.equal(
  extractCanonical(`<link rel="canonical" href="https://mamago.by/minsk/events/foo">`),
  "https://mamago.by/minsk/events/foo",
);
assert.equal(
  extractCanonical(
    `<link rel="canonical" href="https://mamago.by/a"><link rel="canonical" href="https://mamago.by/b">`,
  ),
  null,
);

assert.equal(
  extractRobotsMeta(`<meta name="robots" content="noindex, nofollow">`),
  "noindex, nofollow",
);
assert.equal(
  extractRobotsMeta(`<meta content="index, follow" name="robots">`),
  "index, follow",
);

assert.equal(hasNoindexDirective("index, follow", null), false);
assert.equal(hasNoindexDirective("noindex, nofollow", null), true);
assert.equal(hasNoindexDirective(null, "NOINDEX"), true);

console.log("indexing release verifier parser tests: OK");
