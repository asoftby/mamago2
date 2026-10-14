import assert from "node:assert/strict";
import {
  CANCELLATION_CHIPS,
  PREPAYMENT_CHIPS,
  formatCustomOfferTerm,
  matchOfferTerm,
  offerShowsPaymentTerms,
  pickTermsValue,
  termsColumnValue,
} from "./offerTerms";

// стандартные строки распознаются как чипы (регистр и пробелы не важны)
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, "Предоплата 30%"), { kind: "chip", id: "30" });
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, "  предоплата   30%  "), { kind: "chip", id: "30" });
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, "Без предоплаты"), { kind: "chip", id: "none" });
assert.deepEqual(matchOfferTerm(CANCELLATION_CHIPS, "Без возврата"), { kind: "chip", id: "nr" });
assert.deepEqual(matchOfferTerm(CANCELLATION_CHIPS, "Бесплатная отмена за 7 дней"), { kind: "chip", id: "7d" });

// прежний свободный текст не теряется и не превращается в чип
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, "30% после подтверждения"), {
  kind: "custom",
  text: "30% после подтверждения",
});
assert.deepEqual(matchOfferTerm(CANCELLATION_CHIPS, "Своё: возврат при отмене за 10 дней"), {
  kind: "custom",
  text: "возврат при отмене за 10 дней",
});
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, ""), { kind: "empty" });
assert.deepEqual(matchOfferTerm(PREPAYMENT_CHIPS, null), { kind: "empty" });

// «Своё» хранится с префиксом ровно один раз
assert.equal(formatCustomOfferTerm("возврат за 10 дней"), "Своё: возврат за 10 дней");
assert.equal(formatCustomOfferTerm("Своё: возврат за 10 дней"), "Своё: возврат за 10 дней");
assert.equal(formatCustomOfferTerm("   "), "");
// цикл «сохранили — открыли» стабилен
assert.deepEqual(
  matchOfferTerm(PREPAYMENT_CHIPS, formatCustomOfferTerm("50% за неделю")),
  { kind: "custom", text: "50% за неделю" },
);

// блок условий скрыт только при «Без записи»
assert.equal(offerShowsPaymentTerms("NONE"), false);
assert.equal(offerShowsPaymentTerms("REQUEST_ONLY"), true);
assert.equal(offerShowsPaymentTerms("EXTERNAL"), true);
assert.equal(offerShowsPaymentTerms(null), true);

// колонка и прежнее значение party
assert.equal(termsColumnValue("  "), null);
assert.equal(termsColumnValue(" Без возврата "), "Без возврата");
assert.equal(pickTermsValue("Предоплата 50%", "30% после подтверждения"), "Предоплата 50%");
assert.equal(pickTermsValue(null, "30% после подтверждения"), "30% после подтверждения");
assert.equal(pickTermsValue("  ", undefined), "");

console.log("offerTerms.test.ts: ok");
