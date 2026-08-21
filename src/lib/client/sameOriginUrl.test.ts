import assert from "node:assert/strict";

import { sameOriginUrl } from "./sameOriginUrl";

const originalWindow = globalThis.window;

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { origin: "https://dev.mamago.by" } },
});

assert.equal(
  sameOriginUrl("/minsk/blog/test-article"),
  "https://dev.mamago.by/minsk/blog/test-article",
);
assert.equal(
  sameOriginUrl("https://mamago.by/minsk/blog/test-article?age=5-7#gallery"),
  "https://dev.mamago.by/minsk/blog/test-article?age=5-7#gallery",
);
assert.equal(
  sameOriginUrl("http://mamago.local:3000/blog/test-article"),
  "https://dev.mamago.by/blog/test-article",
);
assert.equal(sameOriginUrl("mailto:hello@mamago.by"), "mailto:hello@mamago.by");

if (originalWindow === undefined) {
  Reflect.deleteProperty(globalThis, "window");
} else {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
}

console.log("sameOriginUrl tests: OK");
