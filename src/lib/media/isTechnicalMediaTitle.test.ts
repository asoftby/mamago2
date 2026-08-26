import assert from "node:assert/strict";
import {
  isTechnicalMediaTitle,
  isTitleDerivedFromOriginalName,
} from "./isTechnicalMediaTitle";

assert.equal(isTechnicalMediaTitle(null), true);
assert.equal(isTechnicalMediaTitle(""), true);
assert.equal(isTechnicalMediaTitle("Media"), true);
assert.equal(isTechnicalMediaTitle("Image"), true);
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
assert.equal(isTechnicalMediaTitle("katie-smith-2ssakjp79ru-unsplash.jpg"), true);
assert.equal(isTechnicalMediaTitle("familyclub.jpg"), true);
assert.equal(isTechnicalMediaTitle("dsc_0675.jpg"), true);

assert.equal(isTechnicalMediaTitle("Клуб английского языка Малберри Клаб 02"), false);
assert.equal(isTechnicalMediaTitle("кафе с детской зоной"), false);
assert.equal(isTechnicalMediaTitle("Иммерсивная выставка «Небо.Река» 01"), false);
assert.equal(
  isTechnicalMediaTitle("Чем заняться на осенних каникулах"),
  false,
);

assert.equal(
  isTitleDerivedFromOriginalName("photo_2024-08-08_18-39-28 (2)", "photo_2024-08-08_18-39-28-2-1.webp"),
  true,
);
assert.equal(isTitleDerivedFromOriginalName("img_0894.jpeg", "img_0894-scaled.jpeg"), true);
assert.equal(isTitleDerivedFromOriginalName("IMG_8536", "img_8536-scaled.jpg"), true);
assert.equal(isTitleDerivedFromOriginalName("media.webp", "media.webp"), true);
assert.equal(
  isTitleDerivedFromOriginalName("Клуб английского языка Малберри Клаб 02", "01-79cy.webp"),
  false,
);

console.log("isTechnicalMediaTitle.test.ts: ok");
