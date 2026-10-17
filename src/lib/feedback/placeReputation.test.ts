import assert from "node:assert/strict";
import { buildPlaceReputationOverview, type PlaceReputationReaction } from "./placeReputation";

const r = (id:string, value: -1|0|1, actorKey="user:"+id, tagIds: string[]=[]):PlaceReputationReaction =>
  ({id,value,actorKey,tagIds});
const input = {
  direct: [r("direct1",1,"user:A",["venue","program"]),r("direct1",1,"user:A",["venue"])],
  eventVisits: [
    r("e1",1,"user:A",["venue","program"]),
    r("e2",-1,"user:B",["venue"]),
    r("e3",1,"user:C",["venue"]),
    r("direct1",1,"user:A",["venue"]), // collision must never double count
  ],
  offerUses: [r("o1",1,"user:D",["program"])],
  legacyPlaceReviewIds: ["legacy1","legacy2"],
  tags: [
    {id:"venue",label:"Удобная парковка",scope:"VENUE" as const},
    {id:"program",label:"Дети в восторге",scope:"PROGRAM" as const},
  ],
  google: {rating:4.6,count:320},
};
const data=buildPlaceReputationOverview(input);
assert.equal(data.direct.count,3);
assert.equal(data.events.count,3);
assert.equal(data.offers.count,1);
assert.equal(data.mamaGoSignals,7);
assert.equal(data.allSourceSignals,327);
assert.equal(data.google?.rating,4.6);
assert.deepEqual(data.topVenueTags,[{label:"Удобная парковка",mentions:3}]);
assert.equal(data.direct.positiveShare,null,"n < 5 cannot show percentage");
assert.equal(data.events.positiveShare,null);
assert.equal(buildPlaceReputationOverview({...input,google:null}).allSourceSignals,7);
const migrated=buildPlaceReputationOverview({
  ...input,
  direct:[{...r("m1",1),migrationKey:"placeReview:legacy1"}],
  eventVisits:[],
  offerUses:[],
});
assert.equal(migrated.direct.historicalCount,1,"migrated old review must be excluded from legacy count");
assert.equal(migrated.direct.count,2);
assert.equal(buildPlaceReputationOverview({
  ...input,direct:[],eventVisits:[],offerUses:[],legacyPlaceReviewIds:[],google:{rating:6,count:2},
}).allSourceSignals,0);
const positive=buildPlaceReputationOverview({
  ...input,
  direct: [r("a",1),r("b",1),r("c",1),r("d",0),r("e",-1)],
  eventVisits:[],offerUses:[],legacyPlaceReviewIds:[],google:null,
});
assert.equal(positive.direct.positiveShare,0.6);
console.log("✅ place reputation projection tests");
