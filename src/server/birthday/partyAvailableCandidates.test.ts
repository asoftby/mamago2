import assert from "node:assert/strict";
import { rankConstructorOffers, assessConstructorOffer } from "./constructorMatching";
import { constructorFixture, requirementsFixture } from "./constructorMatching.fixtures";
const q=requirementsFixture(),busy=constructorFixture('busy'),unknown=constructorFixture('unknown');
busy.availability={state:'UNAVAILABLE',checkedAt:'2026-11-05T00:00:00.000Z',requested:{startAt:'2026-12-01T12:00:00Z',endAt:'2026-12-01T13:00:00Z'},reason:'OCCUPIED'};
const rows=rankConstructorOffers([busy,unknown].map(offer=>({offer,...assessConstructorOffer(offer,q)})));
assert.deepEqual(rows.map(r=>r.offer.offerId),['unknown']);
