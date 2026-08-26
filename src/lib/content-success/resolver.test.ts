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

console.log("content success resolver tests: OK");
