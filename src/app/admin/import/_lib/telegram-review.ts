/**
 * Что показывать редактору по записям Telegram-каналов (чистые функции).
 * Все данные берутся из `qualityFlags`, которые заполняет нормализатор постов
 * и матчинг; новых полей в БД нет.
 */

import {
  asTelegramFlags,
  type TelegramQualityFlags,
} from "@/server/modules/import/normalizers/telegram-post.mapper";

export type TelegramBadge = { key: string; label: string; className: string; title: string };

/** Ниже этого значения уверенности поле помечается «проверить». */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

const POST_KIND_LABEL: Record<string, string> = {
  EVENT: "Событие",
  FESTIVAL: "Фестиваль",
  DIGEST: "Подборка",
  NOT_EVENT: "Не событие",
};

export const SOURCE_CHANGE_FIELD_LABEL: Record<string, string> = {
  dates: "даты",
  venue: "площадка",
  address: "адрес",
  price: "цена",
  title: "название",
  "skip:past_event": "событие уже прошло",
  "skip:incomplete": "нет названия или даты",
  "skip:out_of_territory": "другой город",
  "skip:not_event": "пост больше не анонс",
};

export function postKindLabel(kind: string | null | undefined): string | null {
  return kind ? POST_KIND_LABEL[kind] ?? kind : null;
}

/** Поля с низкой уверенностью модели. Возраст не учитываем: его чаще всего просто нет. */
export function lowConfidenceFields(flags: TelegramQualityFlags): ("dates" | "venue")[] {
  const confidence = flags.confidence;
  if (!confidence) return [];
  const fields: ("dates" | "venue")[] = [];
  if (confidence.dates < LOW_CONFIDENCE_THRESHOLD) fields.push("dates");
  if (confidence.venue < LOW_CONFIDENCE_THRESHOLD) fields.push("venue");
  return fields;
}

export function telegramReviewBadges(rawFlags: unknown): TelegramBadge[] {
  const flags = asTelegramFlags(rawFlags);
  if (!flags) return [];

  const badges: TelegramBadge[] = [
    { key: "telegram", label: "Telegram", className: "bg-sky-100 text-sky-900", title: "Запись из Telegram-канала" },
  ];
  const kind = postKindLabel(flags.postKind);
  if (kind && (flags.postKind === "DIGEST" || flags.postKind === "FESTIVAL")) {
    badges.push({
      key: "postKind",
      label: kind,
      className: "bg-gray-100 text-gray-700",
      title: flags.postKind === "DIGEST" ? "Одно событие из подборки в посте" : "Фестиваль с несколькими днями",
    });
  }
  if (flags.hasConflict) {
    badges.push({
      key: "conflict",
      label: "Текст и афиша расходятся",
      className: "bg-rose-100 text-rose-900",
      title: "Модель нашла разные значения в тексте и на афише; оба показаны в карточке",
    });
  }
  const low = lowConfidenceFields(flags);
  if (low.length > 0) {
    badges.push({
      key: "lowConfidence",
      label: `Проверить: ${low.map((f) => (f === "dates" ? "даты" : "место")).join(", ")}`,
      className: "bg-amber-100 text-amber-900",
      title: "Низкая уверенность модели",
    });
  }
  if (flags.sourceChanged) {
    badges.push({
      key: "sourceChanged",
      label: "Пост изменился",
      className: "bg-violet-100 text-violet-900",
      title: "Источник изменился после первой нормализации или публикации",
    });
  }
  const duplicates = flags.pendingDuplicates?.length ?? 0;
  if (duplicates > 0) {
    badges.push({
      key: "pendingDuplicates",
      label: `Возможный дубль: ${duplicates}`,
      className: "bg-orange-100 text-orange-900",
      title: "Похожая запись другого источника ещё ждёт ревью",
    });
  }
  return badges;
}

/** Пункты блока «Требует внимания» для записи из Telegram. */
export function telegramAttentionItems(flags: TelegramQualityFlags | null): string[] {
  if (!flags) return [];
  const items: string[] = [];
  if (flags.hasConflict) items.push("Текст и афиша расходятся: проверьте дату, время, место и цену по афише");
  const low = lowConfidenceFields(flags);
  if (low.includes("dates")) items.push("Низкая уверенность в датах: сверьте с постом");
  if (low.includes("venue")) items.push("Низкая уверенность в площадке: сверьте с постом");
  if (flags.sourceChanged) items.push("Пост изменился после первой нормализации: проверьте, что поменялось");
  if ((flags.pendingDuplicates?.length ?? 0) > 0) items.push("Есть возможный дубль среди неопубликованных записей другого источника");
  if (flags.coverNeedsReplacement) items.push("Обложка временная (картинка чужого канала): замените перед публикацией");
  return items;
}
