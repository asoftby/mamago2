import assert from "node:assert/strict";

import { normalizeEventPayload } from "./event.normalizer";

{
  const result = normalizeEventPayload({
    sourceSlug: "test-source",
    sourceUrl: "https://example.com/event",
    rawPayload: {
      title: "Экскурсия в ботаническом саду",
      description: "Описание события",
      placeName: "Центральный ботанический сад",
      placeAddress: "ул. Сурганова, 2а",
      city: "Минск",
      startAt: "2026-06-28T10:00:00.000Z",
      category: ["экскурсия"],
    },
  });

  assert.equal(result.normalized.venueName, "Центральный ботанический сад");
  assert.equal(result.normalized.addressText, "ул. Сурганова, 2а");
  assert.equal(result.normalized.cityName, "Минск");
}

{
  const result = normalizeEventPayload({
    sourceSlug: "test-source",
    sourceUrl: "https://example.com/event",
    rawPayload: {
      title: "Семейный фестиваль «Вокруг света Букидс»",
      description: "Описание события",
      venueName: "Центральный ботанический сад",
      addressText:
        "ул. Сурганова, 2а Организаторы проекта «Букидс» объявили даты нового фестиваля и опубликовали программу",
      cityName: "Минск",
      startAt: "2026-06-28T10:00:00.000Z",
      category: ["фестиваль"],
    },
  });

  assert.equal(result.normalized.venueName, "Центральный ботанический сад");
  assert.equal(result.normalized.addressText, "ул. Сурганова, 2а");
  assert.equal(result.normalized.cityName, "Минск");
}

{
  const result = normalizeEventPayload({
    sourceSlug: "test-source",
    sourceUrl: "https://example.com/event",
    rawPayload: {
      title: "Экскурсия в ботаническом саду",
      description:
        "Центральный ботанический сад, ул. Сурганова, 2а. Приходите всей семьёй на прогулку и экскурсию.",
      sourceText:
        "Центральный ботанический сад, ул. Сурганова, 2а. Дополнительный текст источника.",
      placeName: "Центральный ботанический сад",
      city: "Минск",
      startAt: "2026-06-28T10:00:00.000Z",
      category: ["экскурсия"],
    },
  });

  assert.equal(result.normalized.venueName, "Центральный ботанический сад");
  assert.equal(result.normalized.addressText, "ул. Сурганова, 2а");
  assert.equal(result.normalized.cityName, "Минск");
}

console.log("event.normalizer tests: OK");
