import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StepPick } from "../components/steps/StepPick";
import { StepReview, calendarDateKeyToIso } from "../components/steps/StepReview";
import type { PartyFlowState } from "../lib/partySubmitFlow";
import type { BirthdayCatalogItem } from "../lib/realCatalog";
import {
  catalogPriceSummary, eligibleAddons, hasValidCatalogAnchor, selectedCatalogOffers,
} from "../lib/catalogSelection";
import { listUserBirthdayParties, getUserBirthdayPartyDetail } from "@/server/services/userBirthdays.service";

const offer: BirthdayCatalogItem = {
  id: "real-venue", title: "Реальное пространство", productType: "PARTY_SERVICE",
  category: "VENUE", businessId: "business-1", businessName: "Компания",
  placeId: "place-1", placeTitle: "Минск", coverImage: null, priceFrom: 350,
  priceMode: "FROM", currency: "BYN", ageMinMonths: null, ageMaxMonths: null,
  minChildren: null, maxChildren: null, locationType: null, includedCategories: [],
  prepaymentTerms: null, cancellationTerms: null,
};
const packageOffer: BirthdayCatalogItem = {
  ...offer, id: "real-package", title: "Праздник под ключ",
  productType: "PARTY_PACKAGE", category: null, includedCategories: ["CAKE"],
  priceFrom: 650,
};
const cake: BirthdayCatalogItem = {
  ...offer, id: "real-cake", category: "CAKE",
  title: "Настоящий торт", priceFrom: null,
};
const animator: BirthdayCatalogItem = {
  ...offer, id: "real-animator", category: "ANIMATOR",
  title: "Настоящая анимация", priceFrom: 170,
};
const offers = [offer, packageOffer, cake, animator];
const baseProps = {
  citySlug: "minsk", offers, allOfferCount: 4, loading: false, error: null,
  onRetry: () => {}, placeType: "VENUE" as const,
  selectedBaseId: null, selectedAddonIds: [] as string[],
  onSelectBase: () => {}, onToggleAddon: () => {},
};

const markup = renderToStaticMarkup(createElement(StepPick, baseProps));
assert.match(markup, /Реальное пространство/);
assert.match(markup, /Компания/);
assert.match(markup, /От 350/);
assert.doesNotMatch(markup, /4\.9|Подтверждено|Забронировано|Отправить заявку/);
const mobileParty = {
  ...packageOffer, id: "mobile-party", title: "Выездной праздник",
  locationType: "OFF_SITE" as const,
};
const onSiteOnly = { ...offer, locationType: "ON_SITE" as const };
const homeMarkup = renderToStaticMarkup(createElement(StepPick, {
  ...baseProps, placeType: "HOME", offers: [onSiteOnly, mobileParty],
}));
assert.match(homeMarkup, /Выездной праздник/);
assert.doesNotMatch(homeMarkup, /Реальное пространство/);
const empty = renderToStaticMarkup(createElement(StepPick, { ...baseProps, offers: [], allOfferCount: 0 }));
assert.match(empty, /нет опубликованных предложений/);
const filtered = renderToStaticMarkup(createElement(StepPick, { ...baseProps, offers: [], allOfferCount: 4 }));
assert.match(filtered, /По выбранным условиям нет предложений/);
const failure = renderToStaticMarkup(createElement(StepPick, { ...baseProps, error: "Сбой" }));
assert.match(failure, /Повторить загрузку/);
assert.equal(hasValidCatalogAnchor(offers, "real-venue", "VENUE"), true);
assert.equal(hasValidCatalogAnchor(offers, "real-cake", "VENUE"), false);
assert.equal(hasValidCatalogAnchor(offers, "real-cake", "HOME"), true);
assert.equal(hasValidCatalogAnchor(offers, "v1", "VENUE"), false);
assert.equal(eligibleAddons(offers, "real-package", "VENUE").some((o) => o.id === "real-cake"), false);
assert.equal(eligibleAddons(offers, "real-package", "VENUE").some((o) => o.id === "real-animator"), true);
assert.deepEqual(selectedCatalogOffers(offers, "v1", ["a1"]), []);
// The catalog can rank an add-on before the chosen anchor: the anchor must still be first.
assert.deepEqual(selectedCatalogOffers([cake, offer], offer.id, [cake.id]).map((o) => o.id),
  [offer.id, cake.id]);
assert.equal(calendarDateKeyToIso("2026-9-21"), "2026-10-21");
assert.equal(calendarDateKeyToIso("2026-11-25"), "2026-12-25");
assert.equal(calendarDateKeyToIso("2026-1-30"), null);
assert.equal(calendarDateKeyToIso("invalid"), null);
assert.deepEqual(catalogPriceSummary([offer, cake]), {
  minimumByn: 350, hasUnknownPrices: true,
});
const submissionFlow: PartyFlowState = {
  draft: null, pending: null, key: null, submitted: false,
};
const reviewProps = {
  offers: [offer, cake], citySlug: "minsk", dateIso: null,
  quizDateKey: "2026-11-20", timeStart: "12:30", timeEnd: "16:00",
  venueMode: "VENUE" as const, childName: null, authenticated: true,
  authLoading: false, requestLogin: () => {},
  flowStateRef: { current: submissionFlow }, busy: false, onBusyChange: () => {},
  sent: false, onSent: () => {},
};
const review = renderToStaticMarkup(createElement(StepReview, reviewProps));
assert.match(review, /Некоторые услуги рассчитываются индивидуально/);
assert.match(review, /type="date"[^>]*value="2026-12-20"/);
assert.match(review, /type="time"[^>]*value="12:30"/);
assert.match(review, /Отправить заявку основному исполнителю/);
assert.doesNotMatch(review, /Забронировано/);
// Simulate a review-step remount after submission: the parent-owned state persists.
submissionFlow.submitted = true;
const reviewAfterRemount = renderToStaticMarkup(createElement(StepReview, {
  ...reviewProps, sent: submissionFlow.submitted,
}));
assert.match(reviewAfterRemount, /Заявка основному исполнителю отправлена/);
assert.doesNotMatch(reviewAfterRemount, /Данные для заявки/);

const shell = readFileSync("src/features/birthday/builder/components/BirthdayBuilderShell.tsx", "utf8");
for (const forbidden of ["MOCK_PRICES", "buildMockScenarioTimeline", "buildSubmittedScenarioParty", "setSubmittedScenario"]) {
  assert.equal(shell.includes(forbidden), false, "fake booking flow remains: " + forbidden);
}
assert.match(shell, /const submissionFlowRef = useRef<PartyFlowState>/);
assert.match(shell, /flowStateRef=\{submissionFlowRef\}/);
assert.match(shell, /backDisabled=\{submissionBusy \|\| submissionSent\}/);
assert.match(shell, /disabled=\{submissionBusy\}/);

void (async () => {
  assert.deepEqual(await listUserBirthdayParties("user-a"), []);
  assert.equal(await getUserBirthdayPartyDetail("user-a", "demo-birthday-scenario"), null);
  console.log("honestBuilder.contract.test.tsx: OK");
})();
