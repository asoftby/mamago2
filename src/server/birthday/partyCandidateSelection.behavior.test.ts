import assert from "node:assert/strict";
import { rankConstructorOffers, assessConstructorOffer } from "./constructorMatching";
import { constructorFixture, requirementsFixture } from "./constructorMatching.fixtures";
const q=requirementsFixture(),a=constructorFixture('a'),b=constructorFixture('b');
const rows=rankConstructorOffers([b,a].map(offer=>({offer,...assessConstructorOffer(offer,q)})));
assert.deepEqual(rows.map(r=>r.offer.offerId),['a','b'],'deterministic ties do not depend on input order or promotion');
