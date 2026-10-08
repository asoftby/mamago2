/**
 * Anonymized, synthetic message fixtures for the capture pipeline. Each one
 * pairs a realistic incoming message with the draft a correct model would
 * return, plus what the deterministic pipeline must make of it. No real
 * personal messages.
 */
import { entry } from "./captureDraft.testkit";

export type FixtureIds = {
  taya: string;
  styopa: string;
  museum: string;
  parkCentral: string;
  parkSouth: string;
  existingExcursion: string;
  existingLesson: string;
};

export type Fixture = {
  name: string;
  owner: "zero" | "one" | "two";
  text: string | null;
  photo?: boolean;
  anchorAt: string;
  anchorIsForward: boolean;
  /** The JSON a correct model would return. */
  model: (ids: FixtureIds) => unknown;
  expect: {
    intent: "CREATE" | "UPDATE" | "CANCEL" | "NONE";
    entryTypes: string[];
    ruleCodes: string[];
    matched?: (ids: FixtureIds) => string | null;
    requirements?: number;
    childId?: (ids: FixtureIds) => string | null;
    placeId?: (ids: FixtureIds) => string | null;
  };
};

const noMatch = { candidatePlanItemId: null, changes: [] as unknown[] };
const create = (entries: unknown[]) => ({ intent: "CREATE", entries, match: noMatch });
const pay = (text: string, dueAt: string, amount: number) => ({
  kind: "PAY", text, dueAt, dueHasTime: false, amount, currency: "BYN", state: "stated",
});
const bring = (text: string, state: "stated" | "inferred" = "stated") => ({
  kind: "BRING", text, dueAt: null, dueHasTime: false, amount: null, currency: null, state,
});

export const FIXTURES: Fixture[] = [
  {
    name: "excursion with gathering time, payment and water",
    owner: "one",
    text: "Экскурсия в Брестскую крепость 11 октября, начало в 9:30, сбор в 9:00 у школы. Сдать 15 BYN до 7 октября. Взять воду.",
    anchorAt: "2026-10-01T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Экскурсия в Брестскую крепость", state: "stated" },
          startsAt: { value: "2026-10-11T09:30:00+03:00", state: "stated", basis: null },
          arriveAt: { value: "2026-10-11T09:00:00+03:00", state: "stated" },
          location: { value: "школа", placeId: null, state: "stated" },
          requirements: [pay("сдать 15 BYN", "2026-10-07T00:00:00+03:00", 15), bring("вода")],
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: ["CHILD_INFERRED"], requirements: 2 },
  },
  {
    name: "school trip for a named child",
    owner: "two",
    text: "Тая едет на школьную поездку в Мир 12 октября, выезд в 8:00 от школы.",
    anchorAt: "2026-10-02T08:00:00Z",
    anchorIsForward: true,
    model: (ids) =>
      create([
        entry({
          title: { value: "Школьная поездка в Мир", state: "stated" },
          child: { childId: ids.taya, raw: "Тая", state: "stated" },
          startsAt: { value: "2026-10-12T08:00:00+03:00", state: "stated", basis: null },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], childId: (ids) => ids.taya },
  },
  {
    name: "pay money by a date (model mislabels it EVENT)",
    owner: "zero",
    text: "Напоминаем: сдать 20 рублей на ремонт класса до 7 октября.",
    anchorAt: "2026-10-01T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Сдать деньги на ремонт класса", state: "stated" },
          startsAt: { value: null, state: "missing", basis: null },
          dueAt: { value: "2026-10-07T00:00:00+03:00", hasTime: false, state: "stated" },
          requirements: [pay("сдать 20 BYN на ремонт", "2026-10-07T00:00:00+03:00", 20)],
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["TASK"], ruleCodes: ["EVENT_TO_TASK"], requirements: 1 },
  },
  {
    name: "bring water and a snack",
    owner: "zero",
    text: "Праздник в классе 10 октября в 11:00. Принести воду и перекус.",
    anchorAt: "2026-10-03T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Праздник в классе", state: "stated" },
          startsAt: { value: "2026-10-10T11:00:00+03:00", state: "stated", basis: null },
          requirements: [bring("вода"), bring("перекус")],
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], requirements: 2 },
  },
  {
    name: "class tomorrow (relative date from a forward anchor)",
    owner: "zero",
    text: "Завтра занятие по английскому в 17:00.",
    anchorAt: "2026-10-09T12:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          entryType: "ACTIVITY",
          title: { value: "Английский язык", state: "stated" },
          startsAt: { value: "2026-10-10T17:00:00+03:00", state: "inferred", basis: "«завтра» от 9 октября" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["ACTIVITY"], ruleCodes: [] },
  },
  {
    name: "event without a child when the family has two",
    owner: "two",
    text: "Открытый урок 14 октября в 16:00, приходите.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Открытый урок", state: "stated" },
          startsAt: { value: "2026-10-14T16:00:00+03:00", state: "stated", basis: null },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: ["CHILD_ASKED"], childId: () => null },
  },
  {
    name: "event for a specific child",
    owner: "two",
    text: "Стёпа, тренировка по футболу 11 октября в 10:00.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: (ids) =>
      create([
        entry({
          title: { value: "Тренировка по футболу", state: "stated" },
          child: { childId: ids.styopa, raw: "Стёпа", state: "stated" },
          startsAt: { value: "2026-10-11T10:00:00+03:00", state: "stated", basis: null },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], childId: (ids) => ids.styopa },
  },
  {
    name: "message with a payment and a document",
    owner: "zero",
    text: "Поездка в Брест 20 октября. Оплата 50 рублей до 10 октября, справка от врача до 15 октября.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Поездка в Брест", state: "stated" },
          startsAt: { value: "2026-10-20T00:00:00+03:00", state: "stated", basis: null },
          requirements: [
            pay("оплата 50 BYN", "2026-10-10T00:00:00+03:00", 50),
            { kind: "DOCUMENT", text: "справка от врача", dueAt: "2026-10-15T00:00:00+03:00", dueHasTime: false, amount: null, currency: null, state: "stated" },
          ],
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], requirements: 2 },
  },
  {
    name: "task with only a deadline",
    owner: "zero",
    text: "Не забудьте до 12 октября заполнить анкету на сайте школы.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          entryType: "TASK",
          title: { value: "Заполнить анкету на сайте школы", state: "stated" },
          startsAt: { value: null, state: "missing", basis: null },
          dueAt: { value: "2026-10-12T00:00:00+03:00", hasTime: false, state: "stated" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["TASK"], ruleCodes: [] },
  },
  {
    name: "location with an exact place match chosen by the model",
    owner: "zero",
    text: "Встречаемся 13 октября в 12:00 в Музей истории, у главного входа.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: (ids) =>
      create([
        entry({
          title: { value: "Встреча у музея", state: "stated" },
          startsAt: { value: "2026-10-13T12:00:00+03:00", state: "stated", basis: null },
          location: { value: "Музей истории", placeId: ids.museum, state: "stated" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], placeId: (ids) => ids.museum },
  },
  {
    name: "exact place the model left null is substituted by the backend",
    owner: "zero",
    text: "Лекция 13 октября в 15:00, Музей истории.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Лекция", state: "stated" },
          startsAt: { value: "2026-10-13T15:00:00+03:00", state: "stated", basis: null },
          location: { value: "Музей истории", placeId: null, state: "stated" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: ["PLACE_AUTO_EXACT"], placeId: (ids) => ids.museum },
  },
  {
    name: "ambiguous location stays unresolved",
    owner: "zero",
    text: "Прогулка 14 октября в 11:00, идём в парк победы.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Прогулка", state: "stated" },
          startsAt: { value: "2026-10-14T11:00:00+03:00", state: "stated", basis: null },
          location: { value: "парк Победы", placeId: null, state: "stated" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [], placeId: () => null },
  },
  {
    name: "time change of an earlier added event",
    owner: "one",
    text: "Экскурсия в музей переносится: начало в 10:30 вместо 9:30.",
    anchorAt: "2026-10-06T10:00:00Z",
    anchorIsForward: true,
    model: (ids) => ({
      intent: "UPDATE",
      entries: [entry({ startsAt: { value: "2026-10-09T10:30:00+03:00", state: "stated", basis: null } })],
      match: {
        candidatePlanItemId: ids.existingExcursion,
        changes: [{ field: "startsAt", from: "2026-10-09T09:30:00+03:00", to: "2026-10-09T10:30:00+03:00" }],
      },
    }),
    expect: { intent: "UPDATE", entryTypes: ["EVENT"], ruleCodes: ["CHILD_INFERRED"], matched: (ids) => ids.existingExcursion },
  },
  {
    name: "cancellation of an earlier added event",
    owner: "one",
    text: "Экскурсия в музей 9 октября отменяется.",
    anchorAt: "2026-10-06T10:00:00Z",
    anchorIsForward: true,
    model: (ids) => ({
      intent: "CANCEL",
      entries: [entry()],
      match: { candidatePlanItemId: ids.existingExcursion, changes: [] },
    }),
    expect: { intent: "CANCEL", entryTypes: ["EVENT"], ruleCodes: ["CHILD_INFERRED"], matched: (ids) => ids.existingExcursion },
  },
  {
    name: "message without an actionable item",
    owner: "zero",
    text: "Спасибо всем, кто пришёл на собрание! Хороших выходных.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () => ({ intent: "NONE", entries: [], match: noMatch }),
    expect: { intent: "NONE", entryTypes: [], ruleCodes: [] },
  },
  {
    name: "repeat of an event that is already in the plan",
    owner: "one",
    text: "Экскурсия в музей 9 октября в 9:30, не опаздывайте.",
    anchorAt: "2026-10-06T10:00:00Z",
    anchorIsForward: true,
    model: () => create([entry()]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: ["CHILD_INFERRED", "DUPLICATE_FOUND"] },
  },
  {
    name: "screenshot (photo only, anchored at the message date)",
    owner: "zero",
    text: null,
    photo: true,
    anchorAt: "2026-10-09T12:00:00Z",
    anchorIsForward: false,
    model: () =>
      create([
        entry({
          title: { value: "Родительское собрание", state: "stated" },
          startsAt: { value: "2026-10-10T18:00:00+03:00", state: "inferred", basis: "«завтра» от даты сообщения" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: [] },
  },
  {
    name: "hallucinated place id is rejected",
    owner: "zero",
    text: "Выставка 15 октября в 14:00 в галерее на Немиге.",
    anchorAt: "2026-10-05T10:00:00Z",
    anchorIsForward: true,
    model: () =>
      create([
        entry({
          title: { value: "Выставка", state: "stated" },
          startsAt: { value: "2026-10-15T14:00:00+03:00", state: "stated", basis: null },
          location: { value: "галерея на Немиге", placeId: "place-that-does-not-exist", state: "stated" },
        }),
      ]),
    expect: { intent: "CREATE", entryTypes: ["EVENT"], ruleCodes: ["PLACE_ID_REJECTED"], placeId: () => null },
  },
  {
    name: "hallucinated plan item id is rejected",
    owner: "one",
    text: "Занятие отменяется.",
    anchorAt: "2026-10-06T10:00:00Z",
    anchorIsForward: true,
    model: () => ({
      intent: "CANCEL",
      entries: [entry()],
      match: { candidatePlanItemId: "plan-item-that-does-not-exist", changes: [] },
    }),
    expect: {
      intent: "CANCEL",
      entryTypes: ["EVENT"],
      ruleCodes: ["MATCH_ID_REJECTED", "MATCH_NO_CANDIDATE", "CHILD_INFERRED"],
      matched: () => null,
    },
  },
];
