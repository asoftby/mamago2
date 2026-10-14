import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StepBookingMethod } from "./steps/StepBookingMethod";
import { StepOpeningHours } from "./steps/StepOpeningHours";
import { StepClassSchedule } from "./steps/StepClassSchedule";
import { getDefaultFormData } from "./defaults";
import { hoursFromSimple } from "@/lib/offers/offerSchedule";
import type { OfferFormData, OfferProductType } from "./types";

function form(productType: OfferProductType, schedule: Partial<OfferFormData["schedule"]> = {}): OfferFormData {
  const base = getDefaultFormData("place-1");
  return { ...base, productType, schedule: { ...base.schedule, ...schedule } };
}
const noop = () => undefined;
const hours = (data: OfferFormData) =>
  renderToStaticMarkup(createElement(StepOpeningHours, { data, onChange: noop, isEditable: true }));
const booking = (data: OfferFormData, locked = false) =>
  renderToStaticMarkup(
    createElement(StepBookingMethod, { data, onChange: noop, isEditable: true, externalUrlLocked: locked }),
  );

// место: режим работы + закрытые дни; по умолчанию «как у места», закрывать дни нельзя
const place = hours(form("PLACE_VISIT"));
assert.ok(place.includes("1. Когда работаете"));
assert.ok(place.includes("2. Выходные и особые дни"));
assert.ok(place.includes("выберите «Свой график»"));
assert.ok(!place.includes("В разные дни разное время"));

// свой график: пресеты, дни, время и ссылка на режим «по дням»
const own = hours(
  form("PLACE_VISIT", { hoursSource: "own", hours: hoursFromSimple({ days: ["MON", "TUE"], from: "10:00", to: "20:00" }) }),
);
for (const text of ["Каждый день", "Будни", "Выходные", "В разные дни разное время", "Закрытых дат нет"]) {
  assert.ok(own.includes(text), text);
}

// занятия и лагерь: режима работы места нет; закрытые дни занятий живут в блоке расписания занятий
const cls = hours(form("REGULAR_ACTIVITY"));
assert.ok(!cls.includes("Когда работаете"));
assert.ok(!cls.includes("Выходные и особые дни"));
assert.ok(!hours(form("CAMP")).includes("<section"));

// способ записи: три карточки, нумерация зависит от блоков перед ним
const bookingPlace = booking(form("PLACE_VISIT"));
for (const text of ["Без записи", "По заявке", "Своя ссылка", "3. Как к вам записываются", "Календаре кабинета"]) {
  assert.ok(bookingPlace.includes(text), text);
}
assert.ok(booking(form("REGULAR_ACTIVITY")).includes("3. Как к вам записываются"));
assert.ok(booking(form("CAMP")).includes("1. Как к вам записываются"));
assert.ok(!bookingPlace.includes("schedule-external-url"));

// своя ссылка: поле и подсказка про модерацию у опубликованного оффера
const external = booking(form("PLACE_VISIT", { bookingMethod: "EXTERNAL", externalUrl: "https://example.by" }));
assert.ok(external.includes("schedule-external-url"));
assert.ok(!external.includes("Ссылку опубликованного предложения"));
assert.ok(booking(form("PLACE_VISIT", { bookingMethod: "EXTERNAL" }), true).includes("Ссылку опубликованного предложения"));

// прежний режим записи показывается и не пропадает
const legacy = booking(form("PLACE_VISIT", { legacyBookingMode: "USE_PUBLICATION_SLOTS" }));
assert.ok(legacy.includes("По расписанию: выбор времени"));
assert.ok(legacy.includes("сохранены"));

// расписание занятий: регулярные группы и список дат
const classHtml = (data: OfferFormData) =>
  renderToStaticMarkup(createElement(StepClassSchedule, { data, onChange: noop, isEditable: true }));
const regularForm = form("REGULAR_ACTIVITY");
regularForm.classDuration = "60 минут";
regularForm.schedule.classSchedule.groups = [{ id: "g1", days: [2, 4], time: "17:30", seats: "8" }];
const regularHtml = classHtml(regularForm);
for (const text of ["1. Когда проходят занятия", "Группа 1", "Добавить группу", "Курс с началом и концом", "Длительность занятия: 60 мин", "2. Выходные и особые дни"]) {
  assert.ok(regularHtml.includes(text), text);
}
const noDuration = classHtml(form("REGULAR_ACTIVITY"));
assert.ok(noDuration.includes("продолжительность занятия числом"));
const onceForm = form("ONE_TIME_ACTIVITY");
onceForm.classDuration = "90";
onceForm.schedule.classSchedule.dates = [{ id: "d1", date: "2026-10-17", time: "12:00", seats: "" }];
const onceHtml = classHtml(onceForm);
assert.ok(onceHtml.includes("1. Даты занятий"));
assert.ok(onceHtml.includes("Добавить дату"));
assert.ok(!onceHtml.includes("Добавить группу"));

console.log("offerScheduleStep tests passed");
