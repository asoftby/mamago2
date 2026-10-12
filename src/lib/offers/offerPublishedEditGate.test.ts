import assert from "node:assert/strict";
import {
  buildModerationNoticeMessage,
  classifyOfferColumn,
  describeContentColumns,
  mergeCampSessionsForPublished,
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
assert.equal(classifyOfferColumn("priceCaption"), "content");
assert.equal(classifyOfferColumn("priceText"), "content");
assert.equal(classifyOfferColumn("priceTextDerived"), "operational");
assert.equal(classifyOfferColumn("contactPhoneLabel"), "content");
assert.equal(classifyOfferColumn("contactPhone2Label"), "content");
assert.equal(classifyOfferColumn("contactPhone3Label"), "content");
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

// forceContentColumns: «телефон» с произвольным текстом считается контентом
{
  const d = decidePublishedOfferEdit({
    role: "BUSINESS_OWNER",
    currentStatus: "PUBLISHED",
    changedColumns: ["contactPhone", "priceFrom"],
    forceContentColumns: ["contactPhone"],
  });
  assert.equal(d.blocked, true);
  assert.deepEqual(d.contentColumns, ["contactPhone"]);
  assert.deepEqual(d.operationalColumns, ["priceFrom"]);
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

// Сообщение партнёру
assert.equal(describeContentColumns(["coverImage", "galleryImages", "title"]), "фото, название");
assert.equal(describeContentColumns(["somethingNew"]), "другие данные карточки");
assert.equal(
  buildModerationNoticeMessage({ contentColumns: ["title", "galleryImages"], operationalColumns: ["priceFrom"] }),
  "Текст и фото опубликованного предложения пока меняются через поддержку: название, фото. Цены, расписание и контакты сохранены",
);
assert.equal(
  buildModerationNoticeMessage({ contentColumns: ["description"], operationalColumns: [] }),
  "Текст и фото опубликованного предложения пока меняются через поддержку: описание.",
);

// Смены лагеря: даты/цена/места — сразу, тексты смен — нет
{
  const live = [{ id: "s1", title: "Июнь", description: "Описание", dateFrom: "2026-06-01", priceOverride: "500" }];
  // партнёр меняет цену и даты, текст не трогает
  const a = mergeCampSessionsForPublished(live, [
    { id: "s1", title: "Июнь", description: "Описание", dateFrom: "2026-06-03", priceOverride: "550" },
  ]);
  assert.equal(a.contentChanged, false);
  assert.deepEqual(a.merged, [{ id: "s1", title: "Июнь", description: "Описание", dateFrom: "2026-06-03", priceOverride: "550" }]);
  // партнёр меняет цену и текст: цена применяется, текст остаётся прежним, контент отмечен
  const b = mergeCampSessionsForPublished(live, [
    { id: "s1", title: "Новое название", description: "Новый текст", dateFrom: "2026-06-01", priceOverride: "600" },
  ]);
  assert.equal(b.contentChanged, true);
  assert.deepEqual(b.merged, [{ id: "s1", title: "Июнь", description: "Описание", dateFrom: "2026-06-01", priceOverride: "600" }]);
  // новая смена: операционные поля применяются, её текст отбрасывается
  const c = mergeCampSessionsForPublished(live, [
    live[0],
    { id: "s2", title: "Август", dateFrom: "2026-08-01", priceOverride: "700" },
  ]);
  assert.equal(c.contentChanged, true);
  assert.deepEqual(c.merged[1], { id: "s2", dateFrom: "2026-08-01", priceOverride: "700" });
  // смена с неизвестным id не наследует контент чужой смены по позиции
  const f = mergeCampSessionsForPublished(live, [
    { id: "other", title: "Замена", dateFrom: "2026-07-01", priceOverride: "450" },
  ]);
  assert.equal(f.contentChanged, true);
  assert.deepEqual(f.merged, [{ id: "other", dateFrom: "2026-07-01", priceOverride: "450" }]);
  // смена без id сопоставляется по позиции
  const g = mergeCampSessionsForPublished(live, [{ title: "Июнь", description: "Описание", priceOverride: "520" }]);
  assert.equal(g.contentChanged, false);
  assert.equal((g.merged[0] as { title?: string }).title, "Июнь");
  // удаление смены — операционная правка
  const d = mergeCampSessionsForPublished(live, []);
  assert.equal(d.contentChanged, false);
  assert.deepEqual(d.merged, []);
  // sentinel Prisma (DbNull) = «стереть смены»: тоже нельзя
  class DbNull {}
  const h = mergeCampSessionsForPublished(live, new DbNull());
  assert.equal(h.contentChanged, true);
  assert.deepEqual(h.merged, live);
  // стереть все смены нельзя
  const e = mergeCampSessionsForPublished(live, null);
  assert.equal(e.contentChanged, true);
  assert.deepEqual(e.merged, live);
}

console.log("offerPublishedEditGate tests passed");
