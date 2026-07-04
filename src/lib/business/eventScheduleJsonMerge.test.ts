/**
 * Unit test for mergeEventScheduleJson.
 * Run: npx tsx src/lib/business/eventScheduleJsonMerge.test.ts
 */
import assert from "node:assert/strict";
import { mergeEventScheduleJson } from "./eventScheduleJsonMerge";

// 1. Посторонний (legacy) ключ переживает пересохранение
{
  const existing = {
    categoryId: "cat-old",
    importedAgeText: "от 3 лет",
    legacySourceMeta: { importer: "wp", batch: 42 },
  };
  const incoming = {
    categoryId: "cat-new",
    dates: ["2026-07-10"],
  };
  const merged = mergeEventScheduleJson(existing, incoming);
  assert.equal(merged.importedAgeText, "от 3 лет", "legacy scalar key must survive");
  assert.deepEqual(
    merged.legacySourceMeta,
    { importer: "wp", batch: 42 },
    "legacy object key must survive",
  );
  assert.equal(merged.categoryId, "cat-new", "managed key must take incoming value");
  assert.deepEqual(merged.dates, ["2026-07-10"]);
}

// 2. Управляемый ключ, отсутствующий во входящем JSON, удаляется
//    (форма перестала его отправлять — например, cinema у не-кино события)
{
  const existing = {
    cinema: { genre: "animation", duration: 90, trailerUrl: "https://youtu.be/x" },
    pendingLocation: { mode: "PARSED_LOCATION" },
    unknownKey: "keep-me",
  };
  const incoming = { categoryId: "cat-1" };
  const merged = mergeEventScheduleJson(existing, incoming);
  assert.equal("cinema" in merged, false, "omitted managed key must be removed");
  assert.equal("pendingLocation" in merged, false, "omitted managed key must be removed");
  assert.equal(merged.unknownKey, "keep-me");
}

// 3. Управляемый ключ из входящего JSON записывается, даже если в existing его не было
{
  const merged = mergeEventScheduleJson(
    { foo: "bar" },
    { cinema: { genre: "family", duration: 75, trailerUrl: "https://vimeo.com/1" } },
  );
  assert.deepEqual(merged.cinema, {
    genre: "family",
    duration: 75,
    trailerUrl: "https://vimeo.com/1",
  });
  assert.equal(merged.foo, "bar");
}

// 4. Пустые объекты
{
  assert.deepEqual(mergeEventScheduleJson({}, {}), {});
  assert.deepEqual(mergeEventScheduleJson({ a: 1 }, {}), { a: 1 });
  assert.deepEqual(mergeEventScheduleJson({}, { dates: [] }), { dates: [] });
}

// 5. Incoming всегда побеждает — даже для неуправляемого ключа
{
  const merged = mergeEventScheduleJson({ customFlag: false }, { customFlag: true });
  assert.equal(merged.customFlag, true);
}

console.log("eventScheduleJsonMerge.test.ts: all assertions passed");
