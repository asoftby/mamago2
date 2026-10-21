import assert from "node:assert/strict";
import { validateStoredCanonical } from "./validateStoredCanonical";

for (const expectedPath of ["/minsk/places/example", "/minsk/events/example", "/minsk/offers/example", "/minsk/blog/example", "/routes/example"]) {
  const input = { publicBase: "https://mamago.by", expectedPath };
  assert.equal(validateStoredCanonical({ ...input, stored: `https://mamago.by${expectedPath}` }), `https://mamago.by${expectedPath}`);
  for (const stored of [`https://mamago.by${expectedPath}/`, `https://mamago.by${expectedPath}?page=2`, `https://mamago.by${expectedPath}#fragment`, `https://dev.mamago.by${expectedPath}`, `https://mamago.by/marina-gorka/events/example`]) {
    assert.equal(validateStoredCanonical({ ...input, stored }), null, `reject non-canonical URL ${stored}`);
  }
}
assert.equal(validateStoredCanonical({ publicBase: "https://mamago.by", expectedPath: "/", stored: "https://mamago.by/" }), "https://mamago.by/");
console.log("Stored canonical exact-path regressions: OK");
