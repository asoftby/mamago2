import assert from "node:assert/strict";
import { isTechnicalMediaTitle } from "./isTechnicalMediaTitle";

assert.equal(isTechnicalMediaTitle(null), true);
assert.equal(isTechnicalMediaTitle(""), true);
assert.equal(isTechnicalMediaTitle("10793767_0"), true);
assert.equal(isTechnicalMediaTitle("101029746_0.jpg"), true);
assert.equal(isTechnicalMediaTitle("IMG_4888"), true);
assert.equal(isTechnicalMediaTitle("DSC_9765"), true);
assert.equal(isTechnicalMediaTitle("img_1183.jpeg"), true);
assert.equal(isTechnicalMediaTitle("6b0baa53e2e255bd9fb6ab173e8cc24a-2.jpg"), true);
assert.equal(isTechnicalMediaTitle("1-min"), true);
assert.equal(isTechnicalMediaTitle("2024-02-15 11.09.37"), true);
assert.equal(isTechnicalMediaTitle("photo_2024-08-18_01-26-26 (2)"), true);
assert.equal(isTechnicalMediaTitle("photo_2024-08-15_19-56-52"), true);

assert.equal(isTechnicalMediaTitle("Клуб английского языка Малберри Клаб 02"), false);
assert.equal(isTechnicalMediaTitle("кафе с детской зоной"), false);
assert.equal(isTechnicalMediaTitle("Иммерсивная выставка «Небо.Река» 01"), false);

console.log("isTechnicalMediaTitle.test.ts: ok");
