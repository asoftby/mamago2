import assert from "node:assert/strict";
import { resolveLegacySeoDestination } from "./legacySeoRedirectOverrides";

assert.equal(
  resolveLegacySeoDestination("/master-klassy-dlya-detej", "/minsk/events"),
  "/minsk/events/category/workshops",
);

assert.equal(
  resolveLegacySeoDestination("/detskie-spektakli", "/minsk/events"),
  "/minsk/events/category/theatre",
);

assert.equal(
  resolveLegacySeoDestination(
    "/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
    "/minsk/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
  ),
  "/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
);

assert.equal(
  resolveLegacySeoDestination("/unchanged", "/minsk/blog/unchanged"),
  "/minsk/blog/unchanged",
);

console.log("legacySeoRedirectOverrides.test.ts: all assertions passed");
