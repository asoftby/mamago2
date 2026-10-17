import assert from "node:assert/strict";
import { STARTER_FEEDBACK_TAGS, availableFeedbackTags } from "./tagCatalog";

assert.equal(STARTER_FEEDBACK_TAGS.length,20);
assert.equal(new Set(STARTER_FEEDBACK_TAGS.map(x=>x.key)).size,20);
for(const tag of STARTER_FEEDBACK_TAGS){
  assert.ok(tag.label.trim());
  assert.ok(tag.showFor.length > 0);
  assert.ok(tag.targetTypes.length > 0);
  assert.ok(tag.showFor.every(v=>v===-1||v===0||v===1));
}
assert.equal(availableFeedbackTags("ARTICLE",1).length,0);
assert.equal(availableFeedbackTags("NEWS",1).length,0);
assert.equal(availableFeedbackTags("ROUTE",1).length,0);
assert.ok(availableFeedbackTags("EVENT",1).some(x=>x.key==="kids-delighted"));
assert.ok(availableFeedbackTags("EVENT",-1).some(x=>x.key==="crowded"));
assert.ok(!availableFeedbackTags("PLACE",1).some(x=>x.key==="kids-delighted"));
assert.equal(STARTER_FEEDBACK_TAGS.find(x=>x.key==="expensive")?.scope, "GENERAL");
console.log("✅ feedback starter catalog test");
