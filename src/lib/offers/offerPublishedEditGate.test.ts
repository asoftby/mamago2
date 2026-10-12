import assert from "node:assert/strict";
import {
  classifyOfferColumn,
  collectChangedOfferColumns,
  decidePublishedOfferEdit,
  offerValuesEqual,
  shouldBlockPublishedOfferEdit,
} from "./offerPublishedEditGate";
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

// ── Модерация по полям ─────────────────────────────────────────────────────

// Классификация колонок: цены/телефоны/смены — операционные; текст и медиа — контент;
// неизвестная колонка — контент (по умолчанию не обходит модерацию)
assert.equal(classifyOfferColumn("priceFrom"), "operational");
assert.equal(classifyOfferColumn("campSessions"), "operational");
assert.equal(classifyOfferColumn("contactPhone2"), "operational");
assert.equal(classifyOfferColumn("wizardCompletedSteps"), "service");
assert.equal(classifyOfferColumn("title"), "content");
assert.equal(classifyOfferColumn("galleryImages"), "content");
assert.equal(classifyOfferColumn("contactWebsite"), "content");
assert.equal(classifyOfferColumn("somethingNew"), "content");

// Партнёр правит на опубликованном только цену и телефон → не блокируется, поля идут в журнал
{
  const d = decidePublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "PUBLISHED",
    changedColumns: ["priceFrom", "priceItems", "contactPhone", "wizardCompletedSteps"],
  });
  assert.equal(d.blocked, false);
  assert.deepEqual(d.operationalColumns, ["priceFrom", "priceItems", "contactPhone"]);
  assert.deepEqual(d.contentColumns, []);
}

// Цена + название: блокируется из-за названия, операционное всё равно перечислено
{
  const d = decidePublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "PUBLISHED",
    changedColumns: ["priceFrom", "title"],
  });
  assert.equal(d.blocked, true);
  assert.deepEqual(d.contentColumns, ["title"]);
}

// Ничего не изменилось → не блокируется
assert.equal(
  decidePublishedOfferEdit({ role: "BUSINESS_OWNER", currentStatus: "PUBLISHED", changedColumns: [] }).blocked,
  false,
);

// Черновик и админ — без ограничений и без журнала
assert.equal(
  decidePublishedOfferEdit({ role: "BUSINESS_OWNER", currentStatus: "DRAFT", changedColumns: ["title"] }).blocked,
  false,
);
assert.deepEqual(
  decidePublishedOfferEdit({ role: "ADMIN", currentStatus: "PUBLISHED", changedColumns: ["title", "priceFrom"] }),
  { blocked: false, contentColumns: [], operationalColumns: [] },
);

// Совместимый вход: с changedColumns блокирует только контент
assert.equal(
  shouldBlockPublishedOfferEdit({ role: "BUSINESS_OWNER", currentStatus: "PUBLISHED", changedColumns: ["priceFrom"] }),
  false,
);
assert.equal(
  shouldBlockPublishedOfferEdit({ role: "BUSINESS_OWNER", currentStatus: "PUBLISHED", changedColumns: ["description"] }),
  true,
);

// Сравнение значений: пустое = пустое, trim, JSON, sentinel Prisma
assert.equal(offerValuesEqual("", null), true);
assert.equal(offerValuesEqual("  Название ", "Название"), true);
assert.equal(offerValuesEqual(["a", "b"], ["a", "b"]), true);
assert.equal(offerValuesEqual(["a"], ["a", "b"]), false);
assert.equal(offerValuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
assert.equal(offerValuesEqual({ toNumber: () => 15 }, 15), true);
class DbNull {}
assert.equal(offerValuesEqual(new DbNull(), null), true);

// collectChangedOfferColumns: только реально изменившиеся колонки
assert.deepEqual(
  collectChangedOfferColumns(
    { title: "A", priceFrom: 20, galleryImages: ["x"], details: null },
    { title: "A", priceFrom: 15, galleryImages: ["x"], details: undefined },
  ),
  ["priceFrom"],
);

console.log("offerPublishedEditGate tests passed");
