import assert from "node:assert/strict";
import { collectChangedOfferColumns } from "./offerPublishedEditGate";
import { liveOfferComparableOverlay } from "./offerLiveComparable";

// Устаревший оффер без rich-текста: форма синтезирует подпись и акцию из priceText / promotionalOffer
{
  const live = { description: "Просто текст", priceCaption: null, priceText: "от 50 BYN", promotionDetails: null, promotionalOffer: "Скидка 10%" };
  const overlay = liveOfferComparableOverlay(live);
  assert.ok(String(overlay.priceCaption).includes("50"));
  assert.ok(String(overlay.promotionDetails).includes("Скидка"));

  // форма отправила то, что получила → не правка
  const submitted = { description: overlay.description, priceCaption: overlay.priceCaption, promotionDetails: overlay.promotionDetails };
  assert.deepEqual(collectChangedOfferColumns(submitted, { ...live, ...overlay }), []);
  // без нормализации то же самое выглядело бы правкой
  assert.ok(collectChangedOfferColumns(submitted, live).length > 0);

  // реальная правка подписи остаётся правкой
  const edited = { ...submitted, priceCaption: "<p>Новое условие</p>" };
  assert.deepEqual(collectChangedOfferColumns(edited, { ...live, ...overlay }), ["priceCaption"]);
}

// Лагерь: подпись и акция в форме пустые
{
  const overlay = liveOfferComparableOverlay({ campProgramType: "городской", priceCaption: "x", promotionDetails: "y" });
  assert.equal(overlay.priceCaption, "");
  assert.equal(overlay.promotionDetails, "");
}

console.log("offerLiveComparable tests passed");
