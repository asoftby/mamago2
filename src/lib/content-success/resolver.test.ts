import assert from "node:assert/strict";

import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import {
  resolveContentListHref,
  resolveContentSuccessState,
} from "./resolver";

const publicOrigin = getCanonicalPublicAppUrl();

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "admin",
    outcome: "published",
    id: "offer-1",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "published",
    id: "offer-1",
  }),
  "/business/publications/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "published",
    id: "offer-1",
    role: "ADMIN",
    returnTo: "/admin/content/offers",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "admin",
    outcome: "published",
    id: "offer-1",
    role: "ADMIN",
    returnTo: "/business/onboarding",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "submitted",
    id: "offer-1",
    role: "BUSINESS_OWNER",
    returnTo: "/business/onboarding",
  }),
  "/business/onboarding",
);

assert.equal(
  resolveContentListHref({
    kind: "place",
    surface: "business",
    outcome: "published",
    id: "place-1",
    role: "BUSINESS_OWNER",
    returnTo: "/admin/content/places",
  }),
  "/business/publications/places",
);

const adminPublished = resolveContentSuccessState({
  kind: "offer",
  surface: "admin",
  outcome: "published",
  id: "offer-1",
});
assert.ok(adminPublished);
assert.ok(adminPublished.openAction);
assert.ok(adminPublished.continueEditingAction);
assert.deepEqual(adminPublished.listAction, {
  label: "Вернуться к списку",
  href: "/admin/content/offers",
});

const publicPublished = resolveContentSuccessState({
  kind: "offer",
  surface: "admin",
  outcome: "changes_published",
  id: "offer-1",
  returnTo: "/minsk/offers/offer-1",
});
assert.ok(publicPublished);
assert.equal(publicPublished.title, "Публикация обновлена");
assert.equal(publicPublished.listAction, null);
assert.deepEqual(publicPublished.openAction, {
  label: "Смотреть публикацию",
  href: `${publicOrigin}/minsk/offers/offer-1`,
  target: "_self",
});
assert.equal(
  publicPublished.continueEditingAction?.href,
  "/editor/offer/offer-1/edit?returnTo=%2Fminsk%2Foffers%2Foffer-1",
);
assert.equal(
  publicPublished.description,
  "Изменения доступны пользователям. Можно смотреть публикацию или продолжить редактирование.",
);

const publicDraft = resolveContentSuccessState({
  kind: "offer",
  surface: "admin",
  outcome: "draft_saved",
  id: "offer-1",
  returnTo: "/minsk/offers/offer-1",
});
assert.ok(publicDraft);
assert.equal(publicDraft.listAction, null);
assert.deepEqual(publicDraft.openAction, {
  label: "Вернуться к публикации",
  href: `${publicOrigin}/minsk/offers/offer-1`,
  target: "_self",
});
assert.ok(publicDraft.continueEditingAction);

const publicSubmitted = resolveContentSuccessState({
  kind: "offer",
  surface: "business",
  outcome: "submitted",
  id: "offer-1",
  role: "BUSINESS_OWNER",
  returnTo: "/minsk/offers/offer-1",
});
assert.ok(publicSubmitted);
assert.equal(publicSubmitted.listAction, null);
assert.deepEqual(publicSubmitted.openAction, {
  label: "Открыть предпросмотр",
  href: "/me/offers/offer-1/preview",
  target: "_blank",
});
assert.ok(publicSubmitted.continueEditingAction?.href.includes("returnTo="));

const businessPublished = resolveContentSuccessState({
  kind: "offer",
  surface: "business",
  outcome: "published",
  id: "offer-2",
  slug: "family-program",
  citySlug: "minsk",
  offerKind: "SERVICE",
});
assert.ok(businessPublished);
assert.deepEqual(businessPublished.openAction, {
  label: "Смотреть публикацию",
  href: `${publicOrigin}/minsk/offers/family-program`,
  target: "_blank",
});
assert.equal(businessPublished.listAction?.href, "/business/publications/offers");

// Saving an event opened from the business publications list must not
// offer the broken public /publications/events URL as a publication page.
const businessEventDraft = resolveContentSuccessState({
  kind: "event",
  surface: "business",
  outcome: "draft_saved",
  id: "event-1",
  role: "BUSINESS_OWNER",
  returnTo: "/publications/events",
});
assert.ok(businessEventDraft);
assert.equal(businessEventDraft.openAction, null);
assert.deepEqual(businessEventDraft.listAction, {
  label: "Вернуться к списку",
  href: "/business/publications/events",
});
assert.equal(
  businessEventDraft.continueEditingAction?.href,
  "/editor/event/event-1/edit?returnTo=%2Fbusiness%2Fpublications%2Fevents",
);

// The alias may carry filters; keep them intact on return.
assert.equal(resolveContentListHref({
  kind: "event",
  surface: "business",
  outcome: "changes_saved",
  id: "event-1",
  returnTo: "/publications/events?status=published",
}), "/business/publications/events?status=published");

// Public-origin returnTo is different: actual publication detail remains public.
const eventPublicDraft = resolveContentSuccessState({
  kind: "event",
  surface: "business",
  outcome: "draft_saved",
  id: "event-1",
  returnTo: "/minsk/events/test-event",
});
assert.equal(eventPublicDraft?.openAction?.href, `${publicOrigin}/minsk/events/test-event`);
assert.equal(eventPublicDraft?.listAction, null);

// ── Breaking News: exact titles by the real outcome ──────────────────────────
const bn = (outcome: "draft_saved" | "published" | "changes_published" | "changes_saved" | "submitted") =>
  resolveContentSuccessState({ kind: "breaking-news", surface: "admin", outcome, id: "bn-1", slug: "x", citySlug: "minsk", geoScope: "CITY" });
assert.equal(bn("draft_saved")?.title, "Черновик сохранён");
assert.equal(bn("published")?.title, "Новость опубликована");
assert.equal(bn("changes_published")?.title, "Изменения сохранены");
assert.equal(bn("changes_saved")?.title, "Изменения сохранены");
assert.equal(bn("submitted")?.title, "Новость отправлена на модерацию");
// «changes_saved» (e.g. saving a PENDING item) must not claim publication or offer a public link.
assert.doesNotMatch(bn("changes_saved")!.description, /доступн|модерац/i);
assert.notEqual(bn("changes_saved")?.openAction?.label, "Смотреть публикацию");
// Other kinds keep their wording.
const offerSubmitted = resolveContentSuccessState({ kind: "offer", surface: "admin", outcome: "submitted", id: "o" });
assert.equal(offerSubmitted?.title, "Отправлено на модерацию");
assert.equal(resolveContentSuccessState({ kind: "offer", surface: "admin", outcome: "draft_saved", id: "o" })?.title, "Черновик сохранен");

console.log("content success resolver tests: OK");
