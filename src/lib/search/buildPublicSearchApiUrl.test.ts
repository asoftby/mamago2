import assert from "node:assert/strict";
import { buildPublicSearchApiUrl } from "./buildPublicSearchApiUrl";

assert.equal(
  buildPublicSearchApiUrl({ q: "куда сходить", citySlug: "minsk" }),
  "/api/search?q=%D0%BA%D1%83%D0%B4%D0%B0+%D1%81%D1%85%D0%BE%D0%B4%D0%B8%D1%82%D1%8C&limit=8&citySlug=minsk",
);

assert.equal(
  buildPublicSearchApiUrl({ q: "парк", limit: 12 }),
  "/api/search?q=%D0%BF%D0%B0%D1%80%D0%BA&limit=12",
);

assert.ok(
  !buildPublicSearchApiUrl({ q: "тест", citySlug: "  " }).includes("citySlug="),
  "blank citySlug must be omitted",
);

assert.ok(
  buildPublicSearchApiUrl({ q: "тест", citySlug: "brest" }).includes(
    "citySlug=brest",
  ),
  "desktop/mobile callers must include active city slug",
);

console.log("buildPublicSearchApiUrl: PASS");
