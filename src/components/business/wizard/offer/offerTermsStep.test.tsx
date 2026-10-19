import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { StepPaymentTerms } from "./steps/StepPaymentTerms";
import { getDefaultFormData } from "./defaults";
import type { OfferFormData, OfferProductType } from "./types";

async function main() {
  const require = createRequire(import.meta.url);
  require.extensions[".css"] = () => undefined;
  const { buildOfferUpdatePayload, mapOfferToFormData } = await import("./mappers");
  const { getV2StepMembers, isStepComplete, getMissingFieldsForStep } = await import("./offerWizardSteps.config");

  const form = (productType: OfferProductType, patch: Partial<OfferFormData> = {}, bookingMethod: OfferFormData["schedule"]["bookingMethod"] = "REQUEST_ONLY"): OfferFormData => {
    const base = getDefaultFormData("place-1");
    return { ...base, productType, ...patch, schedule: { ...base.schedule, bookingMethod } };
  };
  const render = (data: OfferFormData) =>
    renderToStaticMarkup(createElement(StepPaymentTerms, { data, onChange: () => undefined, isEditable: true }));

  // чипы предоплаты и отмены; «Без записи» блок скрывает целиком
  const html = render(form("PLACE_VISIT"));
  for (const text of ["Предоплата и отмена", "Без предоплаты", "30%", "50%", "100%", "Бесплатно за 24 ч", "Бесплатно за 7 дней", "Без возврата", "Своё"]) {
    assert.ok(html.includes(text), text);
  }
  assert.equal(render(form("PLACE_VISIT", {}, "NONE")), "");

  // прежний нестандартный текст виден как «Своё: …»
  const legacy = render(form("PLACE_VISIT", { prepaymentTerms: "30% после подтверждения" }));
  assert.ok(legacy.includes("Своё: 30% после подтверждения"));

  // зона выезда: только у праздника с выездом
  assert.ok(!html.includes("Зона выезда"));
  const offSite = form("PARTY_SERVICE");
  offSite.birthdayDetails.locationType = "OFF_SITE";
  assert.ok(render(offSite).includes("Зона выезда"));
  const onSite = form("PARTY_SERVICE");
  onSite.birthdayDetails.locationType = "ON_SITE";
  assert.ok(!render(onSite).includes("Зона выезда"));

  // шаг «Условия и контакты» состоит из контактов и условий
  assert.deepEqual(getV2StepMembers("terms", { offerWizardType: "SINGLE", productType: "PLACE_VISIT" }), ["contacts", "paymentTerms"]);

  // телефон обязателен в новом мастере; праздник «только с выездом» требует зону выезда
  const contacts = form("PLACE_VISIT", { placeId: "place-1", contactSource: "manual", phone: "" });
  assert.equal(isStepComplete("contacts", contacts, "v2"), false);
  assert.deepEqual(getMissingFieldsForStep("contacts", contacts, "v2"), ["Телефон"]);
  assert.equal(isStepComplete("contacts", { ...contacts, phone: "+375291234567" }, "v2"), true);
  assert.equal(isStepComplete("contacts", contacts, "v1"), true);
  assert.equal(isStepComplete("contacts", { ...contacts, contactSource: "place" }, "v2"), true);
  assert.equal(isStepComplete("paymentTerms", offSite, "v2"), false);
  assert.deepEqual(getMissingFieldsForStep("paymentTerms", offSite, "v2"), ["Зона выезда"]);
  assert.equal(isStepComplete("paymentTerms", { ...offSite, serviceAreaText: "Минск и до 20 км" }, "v2"), true);
  assert.equal(isStepComplete("paymentTerms", form("PLACE_VISIT"), "v2"), true);

  // колонки уходят только из нового мастера; пустые значения стирают колонку
  const withTerms = form("PLACE_VISIT", { placeId: "place-1", title: "Игровая", prepaymentTerms: "Предоплата 30%", cancellationTerms: "", serviceAreaText: "" });
  const v1 = buildOfferUpdatePayload(withTerms) as Record<string, unknown>;
  assert.ok(!("prepaymentTerms" in v1));
  const v2 = buildOfferUpdatePayload(withTerms, { includeTerms: true }) as Record<string, unknown>;
  assert.equal(v2.prepaymentTerms, "Предоплата 30%");
  assert.equal(v2.cancellationTerms, null);
  assert.equal(v2.serviceAreaText, null);

  // party: значения нового шага копируются в details (каталог праздников читает их оттуда), старое не переносится
  const party = form("PARTY_SERVICE", { placeId: "place-1", title: "Аниматор", prepaymentTerms: "Предоплата 50%", cancellationTerms: "Без возврата" });
  party.birthdayDetails.included = "Аниматор 2 часа";
  party.birthdayDetails.prepaymentTerms = "старый текст";
  const partyPayload = buildOfferUpdatePayload(party, { includeTerms: true }) as { details?: Record<string, unknown> };
  assert.equal(partyPayload.details?.prepaymentTerms, "Предоплата 50%");
  assert.equal(partyPayload.details?.cancellationTerms, "Без возврата");
  const partyV1 = buildOfferUpdatePayload(party) as { details?: Record<string, unknown> };
  assert.equal(partyV1.details?.prepaymentTerms, "старый текст");

  // загрузка: колонка важнее прежнего значения из details; party без колонки берёт значение из details
  const row = (extra: Record<string, unknown>) =>
    mapOfferToFormData({
      kind: "SERVICE",
      productType: "PARTY_SERVICE",
      title: "Аниматор",
      description: null,
      coverImage: null,
      priceFrom: null,
      details: { prepaymentTerms: "30% после подтверждения", cancellationTerms: "возврат за 7 дней" },
      ...extra,
    } as Parameters<typeof mapOfferToFormData>[0]);
  const fromDetails = row({});
  assert.equal(fromDetails.prepaymentTerms, "30% после подтверждения");
  assert.equal(fromDetails.cancellationTerms, "возврат за 7 дней");
  const fromColumn = row({ prepaymentTerms: "Предоплата 100%", serviceAreaText: "Минск" });
  assert.equal(fromColumn.prepaymentTerms, "Предоплата 100%");
  assert.equal(fromColumn.cancellationTerms, "возврат за 7 дней");
  assert.equal(fromColumn.serviceAreaText, "Минск");
  const place = row({ productType: "PLACE_VISIT", details: null });
  assert.equal(place.prepaymentTerms, "");

  console.log("offerTermsStep tests passed");
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
