import assert from "node:assert/strict";
import { assessConstructorOffer } from "./constructorMatching";
import { constructorFixture, requirementsFixture } from "./constructorMatching.fixtures";
const offer=constructorFixture(),q=requirementsFixture();q.category='SHOW';
assert.equal(assessConstructorOffer(offer,q).eligible,true);
q.category='CAKE';assert.equal(assessConstructorOffer(offer,q).eligible,false);
q.category='SHOW';offer.location.mode={state:'KNOWN',value:'ON_SITE'};
assert.equal(assessConstructorOffer(offer,q).eligible,false);
