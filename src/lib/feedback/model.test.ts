import assert from "node:assert/strict";
import {
  feedbackActorKey, feedbackCounts, feedbackOccurrenceKey,
  feedbackPresentation, feedbackPublicEligible, feedbackRankScore,
  feedbackWeight, legacyStarsToFeedbackValue,
  emojiRatingToValue, experienceSentimentToValue,
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
assert.equal(feedbackRankScore({ratings:[],categoryPrior:0.6}), 0.6);
assert.equal(feedbackRankScore({ratings:Array.from({length:5},()=>({value:1 as const,weight:1})),categoryPrior:0.6}), (5+6)/15);
assert.equal(feedbackRankScore({ratings:[{value:0,weight:1.5}],categoryPrior:0,priorWeight:0}),0.5);
assert.throws(()=>feedbackRankScore({ratings:[],categoryPrior:2}));
assert.equal(feedbackWeight({visitStatus:"VERIFIED",ratedAt:new Date("2026-10-16"),now:new Date("2026-10-17")}), 1.5);
assert.equal(feedbackWeight({visitStatus:"NONE",ratedAt:new Date("2024-01-01"),now:new Date("2026-10-17")}), 0.5);
assert.equal(feedbackPublicEligible({isPhoneVerified:false,publicReactionPolicyApproved:true,optedIntoPublic:true}),false);
assert.equal(feedbackPublicEligible({isPhoneVerified:true,publicReactionPolicyApproved:false,optedIntoPublic:true}),false);
assert.equal(feedbackPublicEligible({isPhoneVerified:true,publicReactionPolicyApproved:true,optedIntoPublic:true}),true);
console.log("✅ feedback model test");
