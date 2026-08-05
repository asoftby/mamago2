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
    forwardedFor: "1.2.3.4",
    realIp: null,
  }),
  "u1",
);
assert.equal(
  ratingVoterIdentifier({
    userId: null,
    forwardedFor: "9.9.9.9, 8.8.8.8",
    realIp: null,
  }),
  "ip:9.9.9.9",
);

console.log("✅ emojiRating.test.ts");
