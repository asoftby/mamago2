import assert from "node:assert/strict";
import {
  feedbackActorKey, feedbackCounts, feedbackOccurrenceKey,
  feedbackPresentation, feedbackPublicEligible, legacySentimentRankScore,
  feedbackWeight, legacyStarsToFeedbackValue,
  emojiRatingToValue, experienceSentimentToValue,
  feedbackRankScore, starDistribution, starPresentation, formatStarAverage,
  ratingsWord, resolveCategoryPrior, tagShare, buildOccurrenceKey, parseOccurrenceKey,
  isValidFeedbackValue, isReactionTargetType, sentimentToRepresentativeStars,
  starRatingPublicEligible,
  type FeedbackStars,
} from "./model";

assert.equal(feedbackOccurrenceKey(null), "");
assert.equal(feedbackOccurrenceKey("  occ-1 "), "occ-1");
assert.equal(feedbackActorKey({ userId: "u1" }), "user:u1");
assert.equal(feedbackActorKey({ anonymousOpaqueId: "opaque" }), "guest:opaque");
assert.throws(() => feedbackActorKey({}), /identity is required/);
assert.equal(experienceSentimentToValue("LIKE"), 1);
assert.equal(experienceSentimentToValue("NEUTRAL"), 0);
assert.equal(experienceSentimentToValue("DISLIKE"), -1);
assert.equal(emojiRatingToValue("like"), 1);
assert.equal(emojiRatingToValue("dislike"), -1);
assert.deepEqual([1,2,3,4,5].map(legacyStarsToFeedbackValue), [-1,-1,0,1,1]);
assert.throws(() => legacyStarsToFeedbackValue(0));
assert.deepEqual(feedbackCounts([]), {count:0,positive:0,neutral:0,negative:0,positiveShare:null});
assert.equal(feedbackPresentation(feedbackCounts([])), "Оцените первым");
assert.equal(feedbackPresentation(feedbackCounts([1,-1,0])), "Пока мало оценок · 3");
assert.equal(feedbackPresentation(feedbackCounts([1,1,1,1,-1])), "😍 80% понравилось · 5 оценок");
assert.equal(legacySentimentRankScore({ratings:[],categoryPrior:0.6}), 0.6);
assert.equal(legacySentimentRankScore({ratings:Array.from({length:5},()=>({value:1 as const,weight:1})),categoryPrior:0.6}), (5+6)/15);
assert.equal(legacySentimentRankScore({ratings:[{value:0,weight:1.5}],categoryPrior:0,priorWeight:0}),0.5);
assert.throws(()=>legacySentimentRankScore({ratings:[],categoryPrior:2}));
assert.equal(feedbackWeight({visitStatus:"VERIFIED",ratedAt:new Date("2026-10-16"),now:new Date("2026-10-17")}), 1.5);
assert.equal(feedbackWeight({visitStatus:"NONE",ratedAt:new Date("2024-01-01"),now:new Date("2026-10-17")}), 0.5);
assert.equal(feedbackPublicEligible({isPhoneVerified:false,publicReactionPolicyApproved:true,optedIntoPublic:true}),false);
assert.equal(feedbackPublicEligible({isPhoneVerified:true,publicReactionPolicyApproved:false,optedIntoPublic:true}),false);
assert.equal(feedbackPublicEligible({isPhoneVerified:true,publicReactionPolicyApproved:true,optedIntoPublic:true}),true);

// --- STARS5 -----------------------------------------------------------------
assert.equal(isValidFeedbackValue("STARS5", 5), true);
assert.equal(isValidFeedbackValue("STARS5", 0), false);
assert.equal(isValidFeedbackValue("SENTIMENT3", -1), true);
assert.equal(isValidFeedbackValue("SENTIMENT3", 4), false);
assert.equal(isReactionTargetType("BUSINESS"), false);
assert.equal(isReactionTargetType("PLACE"), true);
assert.deepEqual(([-1,0,1] as const).map(sentimentToRepresentativeStars), [1,3,5]);

// Occurrence keys
assert.equal(buildOccurrenceKey("session", " s1 "), "session:s1");
assert.equal(buildOccurrenceKey("visit", "2026-11-01"), "visit:2026-11-01");
assert.throws(() => buildOccurrenceKey("visit", "2026-02-30"));
assert.throws(() => buildOccurrenceKey("booking", ""));
assert.throws(() => buildOccurrenceKey("plan", "a:b"));
assert.deepEqual(parseOccurrenceKey("offer-session:o1"), { kind: "offer-session", id: "o1" });
assert.equal(parseOccurrenceKey("plan123"), null);
assert.equal(parseOccurrenceKey("unknown:x"), null);

// Distribution and display
const dist = starDistribution([5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,3]);
assert.equal(dist.count, 20);
assert.deepEqual(dist.c, [0,0,1,4,15]);
assert.equal(formatStarAverage(dist.average!), "4,7"); // ТЗ example: 15×5, 4×4, 1×3 → ★ 4,7
assert.throws(() => starDistribution([0 as FeedbackStars]));
assert.equal(starPresentation(starDistribution([])), "Оцените первым");
assert.equal(starPresentation(starDistribution([5,4,5])), "Пока мало оценок · 3");
assert.equal(starPresentation(dist), "★ 4,7 · 20 оценок");
assert.equal(starPresentation({ count: 42, average: 4.66 }), "★ 4,7 · 42 оценки");
assert.equal(starPresentation({ count: 21, average: 5 }), "★ 5,0 · 21 оценка");
assert.deepEqual([1,2,5,11,12,14,21,22,25,101,111].map(ratingsWord),
  ["оценка","оценки","оценок","оценок","оценок","оценок","оценка","оценки","оценок","оценка","оценок"]);

// Category prior
assert.equal(resolveCategoryPrior({ category: { count: 60, mean: 4.4 } }), 4.4);
assert.equal(resolveCategoryPrior({ category: { count: 10, mean: 4.9 }, targetType: { count: 80, mean: 4.2 } }), 4.2);
assert.equal(resolveCategoryPrior({ category: { count: 10, mean: 4.9 }, targetType: { count: 20, mean: 4.2 } }), 4.0);

// Bayesian star index (ТЗ 6.8)
const ones = (n: number, v: FeedbackStars) => Array.from({ length: n }, () => ({ value: v, weight: 1 }));
assert.equal(feedbackRankScore({ ratings: [], categoryPrior: 4.2 }), 4.2); // new object = neutral prior
const single5 = feedbackRankScore({ ratings: ones(1, 5), categoryPrior: 4.2 });
const hundred48 = feedbackRankScore({
  ratings: [...ones(80, 5), ...ones(20, 4)], // average 4.8
  categoryPrior: 4.2,
});
assert.ok(hundred48 > single5, "100 ratings at 4.8 must outrank a single 5★");
assert.ok(Math.abs(single5 - (5 + 42) / 11) < 1e-12);
const verified = feedbackRankScore({ ratings: [{ value: 5, weight: 1.5 }], categoryPrior: 4 });
assert.ok(verified > feedbackRankScore({ ratings: ones(1, 5), categoryPrior: 4 }), "verified visit weighs more");
assert.throws(() => feedbackRankScore({ ratings: [], categoryPrior: 0.6 }));
assert.throws(() => feedbackRankScore({ ratings: [{ value: 5, weight: 0 }], categoryPrior: 4 }));

// Chip share
assert.equal(tagShare({ selected: 4, eligible: 4, distinctAuthors: 4 }), null);
assert.equal(tagShare({ selected: 2, eligible: 10, distinctAuthors: 2 }), null);
assert.equal(tagShare({ selected: 35, eligible: 40, distinctAuthors: 35 }), 0.875);

// Stars of an authenticated user are public without a verified phone (решение 01.11).
assert.equal(starRatingPublicEligible({ authenticated: true }), true);
assert.equal(starRatingPublicEligible({ authenticated: false }), false);

console.log("✅ feedback model test");
