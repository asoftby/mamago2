import assert from "node:assert/strict";
import { shouldBlockPublishedOfferEdit } from "./offerPublishedEditGate";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";

// (а) Правка DRAFT проходит (включая autosave-подобный PATCH без status в теле —
// гейт смотрит только на текущий статус строки в БД)
assert.equal(
  shouldBlockPublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "DRAFT",
  }),
  false,
);

// Правка PENDING тоже проходит (оффер ещё не опубликован)
assert.equal(
  shouldBlockPublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "PENDING",
  }),
  false,
);

// (б) Правка PUBLISHED не-админом блокируется
assert.equal(
  shouldBlockPublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "PUBLISHED",
  }),
  true,
);

// (в) ADMIN может править PUBLISHED напрямую
assert.equal(
  shouldBlockPublishedOfferEdit({
    role: "ADMIN",
    currentStatus: "PUBLISHED",
  }),
  false,
);

// MODERATOR — та же привилегия (canPublishContentDirectly)
assert.equal(
  shouldBlockPublishedOfferEdit({
    role: "MODERATOR",
    currentStatus: "PUBLISHED",
  }),
  false,
);

// (д) Регрессия на существующий гейт роута (data.status === "PUBLISHED" →
// canPublishContentDirectly): ADMIN, правящий PUBLISHED-оффер со status:
// "PUBLISHED" в теле, проходит оба гейта — статус не слетает.
assert.equal(canPublishContentDirectly("ADMIN"), true);
assert.equal(canPublishContentDirectly("MODERATOR"), true);
assert.equal(canPublishContentDirectly("BUSINESS_OWNER"), false);

console.log("offerPublishedEditGate tests passed");
