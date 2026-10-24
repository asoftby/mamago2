import assert from "node:assert/strict";
import {
  bookingColumnsForMethod,
  bookingMethodFromColumns,
  buildScheduleInput,
  buildChangedScheduleInput,
  defaultOfferSchedule,
  getScheduleMissingFields,
  hoursFromSimple,
  isValidDateKey,
  normalizeClosedDates,
  offerScheduleInputSchema,
  simpleFromHours,
  toggleClosedDate,
  validateExternalUrl,
} from "./offerSchedule";

// способ записи → колонки: только REQUEST_ONLY включает bookingEnabled (по нему создаётся BookingRequest)
assert.deepEqual(bookingColumnsForMethod("NONE"), { bookingEnabled: false, bookingMode: "NONE" });
assert.deepEqual(bookingColumnsForMethod("EXTERNAL"), { bookingEnabled: false, bookingMode: "EXTERNAL" });
assert.deepEqual(bookingColumnsForMethod("REQUEST_ONLY"), { bookingEnabled: true, bookingMode: "REQUEST_ONLY" });

// колонки → способ: прежние режимы не превращаем в новые
assert.deepEqual(bookingMethodFromColumns({ bookingEnabled: true, bookingMode: "USE_PUBLICATION_SLOTS" }), {
  method: null,
  legacy: "USE_PUBLICATION_SLOTS",
});
assert.deepEqual(bookingMethodFromColumns({ bookingEnabled: true, bookingMode: null }), {
  method: "REQUEST_ONLY",
  legacy: null,
});
assert.deepEqual(bookingMethodFromColumns({ bookingEnabled: false, bookingMode: null }), { method: null, legacy: null });
assert.deepEqual(bookingMethodFromColumns({ bookingEnabled: false, bookingMode: "EXTERNAL" }), {
  method: "EXTERNAL",
  legacy: null,
});

// простой режим работы
const hours = hoursFromSimple({ days: ["MON", "TUE", "WED"], from: "10:00", to: "20:00" });
assert.equal(hours.rules.filter((rule) => rule.isOpen).length, 3);
assert.deepEqual(simpleFromHours(hours), { days: ["MON", "TUE", "WED"], from: "10:00", to: "20:00" });
hours.rules[1].intervals = [{ startTime: "12:00", endTime: "18:00" }];
assert.equal(simpleFromHours(hours), null);

// закрытые дни
assert.equal(isValidDateKey("2026-02-30"), false);
assert.equal(isValidDateKey("2026-10-18"), true);
assert.deepEqual(normalizeClosedDates(["2026-11-07", "bad", "2026-10-18", "2026-11-07"]), ["2026-10-18", "2026-11-07"]);
assert.deepEqual(toggleClosedDate(["2026-10-18"], "2026-10-18"), []);
assert.deepEqual(toggleClosedDate(["2026-11-07"], "2026-10-18"), ["2026-10-18", "2026-11-07"]);

// ссылка
assert.ok(validateExternalUrl(""));
assert.ok(validateExternalUrl("javascript:alert(1)"));
assert.ok(validateExternalUrl("https://localhost"));
assert.equal(validateExternalUrl("https://tickets.example.by/show"), null);

// форма → запрос
const form = defaultOfferSchedule();
assert.deepEqual(buildScheduleInput(form, "PLACE_VISIT"), { hours: { source: "place" } });
assert.deepEqual(buildScheduleInput(form, "CAMP"), { bookingMethod: "REQUEST_ONLY", external: null });
form.bookingMethod = "EXTERNAL";
form.externalUrl = " https://example.by/buy ";
assert.deepEqual(buildScheduleInput(form, "CAMP"), {
  bookingMethod: "REQUEST_ONLY",
  external: null,
});
form.bookingMethod = "NONE";
assert.equal(buildScheduleInput(form, "CAMP").external, null);

// закрытые дни у занятия создают собственный график; график места не меняется, пока дней нет
const classForm = defaultOfferSchedule();
// занятия: без длительности расписание не отправляется; закрытые дни не попадают в OpeningHours
assert.deepEqual(buildScheduleInput(classForm, "REGULAR_ACTIVITY"), {});
classForm.closedDates = ["2026-10-18"];
classForm.classSchedule.groups = [{ id: "g1", days: [2, 4], time: "17:30", seats: "8" }];
assert.equal(buildScheduleInput(classForm, "REGULAR_ACTIVITY").hours, undefined);
assert.deepEqual(buildScheduleInput(classForm, "REGULAR_ACTIVITY", "60 минут").classSchedule, {
  kind: "recurring",
  durationMin: 60,
  groups: [{ days: [2, 4], time: "17:30", seats: 8 }],
  dates: [],
  period: null,
  closedDates: ["2026-10-18"],
});

// прежний режим записи: bookingMethod не отправляется
const legacy = defaultOfferSchedule();
legacy.legacyBookingMode = "USE_PUBLICATION_DATES";
assert.equal(buildScheduleInput(legacy, "PLACE_VISIT").bookingMethod, undefined);
assert.deepEqual(getScheduleMissingFields(legacy, "PLACE_VISIT"), []);

// обязательные поля шага
assert.deepEqual(getScheduleMissingFields(defaultOfferSchedule(), "PLACE_VISIT"), ["Способ записи"]);
const ext = defaultOfferSchedule();
ext.bookingMethod = "EXTERNAL";
assert.deepEqual(getScheduleMissingFields(ext, "PLACE_VISIT"), ["Ссылка для записи"]);
const own = defaultOfferSchedule();
own.bookingMethod = "NONE";
own.hoursSource = "own";
assert.deepEqual(getScheduleMissingFields(own, "PARTY_PACKAGE"), ["Дни работы"]);

// Лагеря: только заявка через mamaGo; нельзя сохранить старую внешнюю ссылку.
const camp = defaultOfferSchedule();
assert.deepEqual(getScheduleMissingFields(camp, "CAMP"), []);
camp.bookingMethod = "EXTERNAL";
camp.externalUrl = "https://example.by/camp";
assert.deepEqual(getScheduleMissingFields(camp, "CAMP"), []);
camp.bookingMethod = "NONE";
assert.deepEqual(getScheduleMissingFields(camp, "CAMP"), []);
camp.bookingMethod = "REQUEST_ONLY";
assert.deepEqual(getScheduleMissingFields(camp, "CAMP"), []);
assert.deepEqual(buildChangedScheduleInput(defaultOfferSchedule(), defaultOfferSchedule(), "CAMP"), {
  bookingMethod: "REQUEST_ONLY", external: null,
});
assert.equal(buildChangedScheduleInput(camp, camp, "CAMP"), undefined);

// схема запроса
assert.equal(offerScheduleInputSchema.safeParse({ bookingMethod: "EXTERNAL", external: { kind: "TICKETS", url: "" } }).success, false);
assert.equal(offerScheduleInputSchema.safeParse({ bookingMethod: "NONE" }).success, true);
assert.equal(
  offerScheduleInputSchema.safeParse({
    hours: { source: "own", data: { mode: "WEEKLY", timezone: "Europe/Minsk", rules: [] }, closedDates: ["2026-13-40"] },
  }).success,
  true, // формат даты проверяет regex; календарную корректность — normalizeClosedDates на сервере
);
assert.equal(
  offerScheduleInputSchema.safeParse({
    hours: { source: "own", data: { mode: "WEEKLY", timezone: "Europe/Minsk", rules: [{ dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "25:00", endTime: "26:00" }] }] }, closedDates: [] },
  }).success,
  false,
);

console.log("offerSchedule.test.ts: ok");

// Concurrent edit safety: changing the booking mode must not resend stale hours.
const base = defaultOfferSchedule();
base.bookingMethod = "NONE";
base.hoursSource = "own";
base.hours = hoursFromSimple({ days: ["MON"], from: "09:00", to: "18:00" });
const next = structuredClone(base);
next.bookingMethod = "REQUEST_ONLY";
assert.deepEqual(buildChangedScheduleInput(next, base, "PLACE_VISIT"), {
  bookingMethod: "REQUEST_ONLY", external: null,
});
assert.equal(buildChangedScheduleInput(base, base, "PLACE_VISIT"), undefined);
const updatedHours = structuredClone(base);
updatedHours.closedDates = ["2026-11-07"];
assert.equal(buildChangedScheduleInput(updatedHours, base, "PLACE_VISIT")?.bookingMethod, undefined);
assert.equal(buildChangedScheduleInput(updatedHours, base, "PLACE_VISIT")?.hours?.source, "own");
const cleared = structuredClone(updatedHours);
cleared.closedDates = [];
// занятия: снятие последней закрытой даты уходит как classSchedule с пустым списком
const classPrev = defaultOfferSchedule();
classPrev.classSchedule.groups = [{ id: "g1", days: [1], time: "10:00", seats: "" }];
classPrev.closedDates = ["2026-11-07"];
const classNext = structuredClone(classPrev);
classNext.closedDates = [];
assert.deepEqual(buildChangedScheduleInput(classNext, classPrev, "REGULAR_ACTIVITY", "45 мин", "45 мин")?.classSchedule?.closedDates, []);
assert.equal(buildChangedScheduleInput(classPrev, classPrev, "REGULAR_ACTIVITY", "45 мин", "45 мин"), undefined);
// смена длительности пересчитывает концы занятий: расписание уходит заново
assert.equal(buildChangedScheduleInput(classPrev, classPrev, "REGULAR_ACTIVITY", "90 мин", "45 мин")?.classSchedule?.durationMin, 90);
