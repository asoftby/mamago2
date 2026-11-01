import assert from "node:assert/strict";
import { STARTER_FEEDBACK_TAGS, availableFeedbackTags, availableFeedbackTagsForSentiment, type StarterFeedbackTag } from "./tagCatalog";

assert.equal(STARTER_FEEDBACK_TAGS.length,20);
assert.equal(new Set(STARTER_FEEDBACK_TAGS.map(x=>x.key)).size,20);
for(const tag of STARTER_FEEDBACK_TAGS){
  assert.ok(tag.label.trim());
  assert.ok(tag.showFor.length > 0);
  assert.ok(tag.targetTypes.length > 0);
  assert.ok(tag.showFor.every(v=>Number.isInteger(v)&&v>=1&&v<=5));
}
assert.equal(availableFeedbackTags("ARTICLE",5).length,0);
assert.equal(availableFeedbackTags("NEWS",5).length,0);
assert.equal(availableFeedbackTags("ROUTE",5).length,0);
assert.equal(availableFeedbackTags("BUSINESS",5).length,0);
assert.ok(availableFeedbackTags("EVENT",5).some(x=>x.key==="kids-delighted"));
assert.ok(availableFeedbackTags("EVENT",1).some(x=>x.key==="crowded"));
assert.ok(!availableFeedbackTags("PLACE",5).some(x=>x.key==="kids-delighted"));
assert.ok(!availableFeedbackTags("EVENT",3).some(x=>x.key==="would-return"));
assert.ok(availableFeedbackTags("EVENT",3).some(x=>x.key==="boring") && availableFeedbackTags("EVENT",3).some(x=>x.key==="kids-delighted"));

// Legacy sentiment filtering is unchanged by the star conversion.
const legacy: Record<string, Array<-1|0|1>> = {
  "kids-delighted":[1,0], "would-return":[1], "boring":[-1,0], "clean":[1,0], "dirty":[-1,0],
};
for (const [key, showFor] of Object.entries(legacy)) {
  for (const v of [-1,0,1] as const) {
    const offered = availableFeedbackTagsForSentiment("PLACE",v).some(x=>x.key===key)
      || availableFeedbackTagsForSentiment("EVENT",v).some(x=>x.key===key);
    assert.equal(offered, showFor.includes(v), `${key} for ${v}`);
  }
}

// Party-category chips are offered only for matching party services.
const party: StarterFeedbackTag = { key:"punctual", label:"Пунктуальность", scope:"PROGRAM", showFor:[4,5], targetTypes:["OFFER"], partyCategories:["ANIMATOR"] };
assert.ok(availableFeedbackTags("OFFER",5,[party],"ANIMATOR").length===1);
assert.ok(availableFeedbackTags("OFFER",5,[party],"CAKE").length===0);
assert.ok(availableFeedbackTags("OFFER",5,[party]).length===0);
assert.equal(STARTER_FEEDBACK_TAGS.find(x=>x.key==="expensive")?.scope, "GENERAL");
console.log("✅ feedback starter catalog test");
