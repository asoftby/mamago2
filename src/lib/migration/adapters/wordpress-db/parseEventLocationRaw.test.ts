import assert from "node:assert/strict";

import { parseEventLocationRaw } from "./parseEventLocationRaw";

function testNullAndUndefined() {
  assert.deepEqual(parseEventLocationRaw(null), { location: null, invalidJsonLike: false });
  assert.deepEqual(parseEventLocationRaw(undefined), { location: null, invalidJsonLike: false });
}

function testWhitespaceOnly() {
  assert.deepEqual(parseEventLocationRaw("   "), { location: null, invalidJsonLike: false });
}

function testPlainText() {
  const result = parseEventLocationRaw("Минск, Central Park");
  assert.deepEqual(result, { location: { address: "Минск, Central Park", lat: null, lng: null }, invalidJsonLike: false });
}

function testPlainTextTrimmed() {
  const result = parseEventLocationRaw("  ул. Мясникова 44, Минск  ");
  assert.equal(result.location?.address, "ул. Мясникова 44, Минск");
}

function testFullValidJson() {
  const raw = '{"address":"улица Мясникова 44, Минск","map_picker":false,"latitude":53.89602,"longitude":27.53968}';
  const result = parseEventLocationRaw(raw);
  assert.equal(result.invalidJsonLike, false);
  assert.deepEqual(result.location, { address: "улица Мясникова 44, Минск", lat: 53.89602, lng: 27.53968 });
  assert.ok(!result.location?.address?.startsWith("{"), "address must never be the raw JSON blob");
}

function testMalformedJsonLikeString() {
  const result = parseEventLocationRaw('{"address":"broken, not valid json');
  assert.equal(result.invalidJsonLike, true);
  assert.equal(result.location, null);
}

function testJsonArrayIsNotAnObject() {
  const result = parseEventLocationRaw('["not", "an", "object"]');
  // Doesn't start with "{" — treated as plain text, not JSON-like.
  assert.equal(result.invalidJsonLike, false);
  assert.equal(result.location?.address, '["not", "an", "object"]');
}

function testMissingAddressKeepsValidCoordinates() {
  const result = parseEventLocationRaw('{"latitude":53.9,"longitude":27.5}');
  assert.deepEqual(result.location, { address: null, lat: 53.9, lng: 27.5 });
  assert.equal(result.invalidJsonLike, false);
}

function testStringCoordinatesTreatedAsMissing() {
  const result = parseEventLocationRaw('{"address":"Минск","latitude":"53.9","longitude":"27.5"}');
  assert.deepEqual(result.location, { address: "Минск", lat: null, lng: null });
}

function testNaNAndInfiniteCoordinatesTreatedAsMissing() {
  const nanResult = parseEventLocationRaw('{"address":"Минск","latitude":NaN,"longitude":27.5}');
  // NaN is not valid JSON — this whole payload fails to parse.
  assert.equal(nanResult.invalidJsonLike, true);

  const infResult = parseEventLocationRaw('{"address":"Минск","latitude":1e400,"longitude":27.5}');
  // 1e400 parses as Infinity in JSON.parse (JS number overflow).
  assert.deepEqual(infResult.location, { address: "Минск", lat: null, lng: null });
}

function testOutOfRangeCoordinatesTreatedAsMissing() {
  const result = parseEventLocationRaw('{"address":"Минск","latitude":953.9,"longitude":27.5}');
  assert.deepEqual(result.location, { address: "Минск", lat: null, lng: null });
}

function testZeroZeroTreatedAsMissing() {
  const result = parseEventLocationRaw('{"address":"Минск","latitude":0,"longitude":0}');
  assert.deepEqual(result.location, { address: "Минск", lat: null, lng: null });
}

function testEmptyJsonObjectResolvesToNull() {
  const result = parseEventLocationRaw("{}");
  assert.deepEqual(result, { location: null, invalidJsonLike: false });
}

function main() {
  testNullAndUndefined();
  testWhitespaceOnly();
  testPlainText();
  testPlainTextTrimmed();
  testFullValidJson();
  testMalformedJsonLikeString();
  testJsonArrayIsNotAnObject();
  testMissingAddressKeepsValidCoordinates();
  testStringCoordinatesTreatedAsMissing();
  testNaNAndInfiniteCoordinatesTreatedAsMissing();
  testOutOfRangeCoordinatesTreatedAsMissing();
  testZeroZeroTreatedAsMissing();
  testEmptyJsonObjectResolvesToNull();
}

main();
console.log("parseEventLocationRaw tests: OK");
