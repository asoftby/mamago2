import assert from "node:assert/strict";
import { rankConstructorOffers, assessConstructorOffer } from "./constructorMatching";
import { constructorFixture, requirementsFixture } from "./constructorMatching.fixtures";
const q=requirementsFixture();q.interests={state:'KNOWN',value:['science']};
const a=constructorFixture('a'),b=constructorFixture('b');b.interests={state:'KNOWN',value:['science']};
const rows=rankConstructorOffers([a,b].map(offer=>({offer,...assessConstructorOffer(offer,q)})));
assert.deepEqual(rows.map(r=>r.offer.offerId),['b','a']);
assert.equal(rows.length,2,'soft interests never exclude unknown offers');
