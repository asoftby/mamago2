import assert from "node:assert/strict";
import { isValidOfferPhone } from "./offerPhone";

assert.equal(isValidOfferPhone("+375 (29) 123-45-67"), true);
assert.equal(isValidOfferPhone("80291234567"), true);
assert.equal(isValidOfferPhone("Реклама 123456789"), false);
assert.equal(isValidOfferPhone("12345"), false);
assert.equal(isValidOfferPhone("тел. +375291234567"), false);
assert.equal(isValidOfferPhone(""), false);

console.log("offerPhone tests passed");
