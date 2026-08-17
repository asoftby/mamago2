import assert from "node:assert/strict";
import {
  countsFromGroupBy,
  emptyEmojiRatingCounts,
  isEmojiRatingType,
  ratingVoterIdentifier,
} from "./emojiRating";

assert.equal(isEmojiRatingType("like"), true);
assert.equal(isEmojiRatingType("meh"), false);

assert.deepEqual(emptyEmojiRatingCounts(), {
  like: 0,
  neutral: 0,
  dislike: 0,
});

assert.deepEqual(
  countsFromGroupBy([
    { ratingType: "like", _count: 3 },
    { ratingType: "nope", _count: 9 },
    { ratingType: "dislike", _count: 1 },
  ]),
  { like: 3, neutral: 0, dislike: 1 },
);

assert.equal(
  ratingVoterIdentifier({
    userId: "u1",
    ip: "1.2.3.4",
  }),
  "u1",
);
assert.equal(
  ratingVoterIdentifier({
    userId: null,
    ip: "9.9.9.9",
  }),
  "ip:9.9.9.9",
);
assert.equal(
  ratingVoterIdentifier({
    userId: null,
    ip: null,
  }),
  "ip:anonymous",
  "null ip (gate off or malformed header) must fall back to the anonymous literal, not crash or produce a fabricated identity",
);

console.log("✅ emojiRating.test.ts");
