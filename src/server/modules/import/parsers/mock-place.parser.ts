/**
 * MockPlaceParser
 *
 * Dev-safe парсер с фиксированными данными.
 * Используется для тестирования pipeline без реального crawling.
 * parserKey: "mock-place"
 */

import type { ImportSource } from "@prisma/client";
import type { PlaceImportParser } from "./base.parser";
import type { ParserResult } from "../types";
import { makeRawRecord } from "./base.parser";
import { PLACE_FIXTURES } from "./fixture-scenarios";

const MOCK_RECORDS = [
  {
    externalId: "mock-001",
    sourceUrl: "https://example.com/places/cafe-central",
    rawPayload: {
      name: "Кафе Централь",
      shortDescription: "Уютное кафе в центре города",
      description: "Кафе Централь — место для семейного отдыха и деловых встреч. Детское меню, игровая зона.",
      address: "ул. Ленина, 10, Минск",
      city: "Минск",
      lat: 53.9045,
      lng: 27.5615,
      phone: "+375291234567",
      website: "https://cafe-central.by",
      categories: ["кафе", "семейный отдых", "детское меню"],
      images: ["https://example.com/img/cafe1.jpg", "https://example.com/img/cafe2.jpg"],
      openingHours: "Пн-Пт 9:00-22:00, Сб-Вс 10:00-23:00",
    },
  },
  {
    externalId: "mock-002",
    sourceUrl: "https://example.com/places/park-gorky",
    rawPayload: {
      name: "Парк Горького",
      shortDescription: "Центральный парк культуры и отдыха",
      description: "Парк Горького — один из крупнейших парков Минска. Аттракционы, пруд, летний театр.",
      address: "ул. Фрунзе, 2, Минск",
      city: "Минск",
      lat: 53.8975,
      lng: 27.5490,
      phone: null,
      website: "https://parkgorky.by",
      categories: ["парк", "аттракционы", "прогулки"],
      images: ["https://example.com/img/park1.jpg"],
      openingHours: "Ежедневно 8:00-22:00",
    },
  },
  {
    externalId: "mock-003",
    sourceUrl: "https://example.com/places/incomplete-place",
    rawPayload: {
      // Намеренно неполная запись — для тестирования partial normalization
      name: "Место без деталей",
      categories: [],
    },
  },
  // Fixture scenarios
  PLACE_FIXTURES.PLACE_CREATE_FULL,
  PLACE_FIXTURES.PLACE_CATEGORY_FAIL,
];

export const mockPlaceParser: PlaceImportParser = {
  parserKey: "mock-place",
  entityType: "PLACE",

  async parse(_source: ImportSource): Promise<ParserResult> {
    const records = MOCK_RECORDS.map((r) =>
      makeRawRecord(r.sourceUrl, r.rawPayload, {
        externalId: r.externalId,
        canonicalSourceUrl: r.sourceUrl,
        sourceUpdatedAt: new Date(),
      }),
    );

    return {
      records,
      totalFound: records.length,
      parserKey: "mock-place",
    };
  },
};
