import assert from "node:assert/strict";
import { detectAgeBuckets, mapParsedAgeToBuckets } from "./ageMapping";

{
  const result = mapParsedAgeToBuckets("4-7 лет");
  assert.deepEqual(result.buckets, ["3-5", "5-7"]);
  assert.equal(result.parsedMinAge, 4);
  assert.equal(result.parsedMaxAge, 7);
}

{
  const result = mapParsedAgeToBuckets("от 4 до 7 лет");
  assert.deepEqual(result.buckets, ["3-5", "5-7"]);
  assert.equal(result.parsedMinAge, 4);
  assert.equal(result.parsedMaxAge, 7);
}

{
  const result = detectAgeBuckets("от 4 до 7 лет");
  assert.deepEqual(result.suggestedBuckets, ["3-5", "5-7"]);
  assert.equal(result.normalizedLabel, "4–7 лет");
}

console.log("ageMapping tests: OK");
