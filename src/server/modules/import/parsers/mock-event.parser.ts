/**
 * MockEventParser
 *
 * Dev-safe парсер с фиксированными данными для EVENT.
 * parserKey: "mock-event"
 */

import type { ImportSource } from "@prisma/client";
import type { EventImportParser } from "./base.parser";
import type { ParserResult } from "../types";
import { makeRawRecord } from "./base.parser";
import { EVENT_FIXTURES } from "./fixture-scenarios";

const MOCK_RECORDS = [
  {
    externalId: "mock-event-001",
    sourceUrl: "https://example.com/events/kids-art-workshop",
    rawPayload: {
      title: "Мастер-класс по рисованию для детей",
      shortDescription: "Творческий мастер-класс для детей от 4 до 10 лет",
      description: "Дети познакомятся с акварельными техниками, нарисуют свой первый пейзаж под руководством опытного педагога.",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
      startDate: "2026-05-10T11:00:00",
      endDate: "2026-05-10T13:00:00",
      venue: "Арт-студия «Краски»",
      address: "ул. Немига, 5, Минск",
      city: "Минск",
      price: "25 BYN",
      ageRange: "4-10 лет",
      categories: ["мастер-класс", "рисование", "творчество"],
      organizer: "Арт-студия Краски",
      images: ["https://example.com/img/art1.jpg"],
    },
  },
  {
    externalId: "mock-event-002",
    sourceUrl: "https://example.com/events/science-course",
    rawPayload: {
      title: "Курс юного учёного",
      description: "Еженедельные занятия по химии и физике для школьников 8-14 лет. Опыты, эксперименты, открытия.",
      type: "COURSE",
      scheduleMode: "RECURRING",
      scheduleText: "Каждую субботу, 10:00-12:00",
      venue: "Центр «Наука и жизнь»",
      city: "Минск",
      price: "80 BYN / месяц",
      ageRange: "8-14 лет",
      categories: ["курс", "наука", "образование"],
      organizer: "Центр Наука и жизнь",
      images: [],
    },
  },
  {
    externalId: "mock-event-003",
    sourceUrl: "https://example.com/events/incomplete-event",
    rawPayload: {
      // Намеренно неполная запись — для тестирования partial normalization
      title: "Событие без деталей",
    },
  },
  // Fixture scenarios
  EVENT_FIXTURES.EVENT_CREATE_FULL,
  EVENT_FIXTURES.EVENT_TYPE_FAIL,
  EVENT_FIXTURES.EVENT_SCHEDULE_FAIL,
];

export const mockEventParser: EventImportParser = {
  parserKey: "mock-event",
  entityType: "EVENT",

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
      parserKey: "mock-event",
    };
  },
};
