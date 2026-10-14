import assert from "node:assert/strict";
import {
  campShiftDuration,
  createEmptyCampSession,
  formatCampShiftDuration,
  getCampShiftMissingFields,
  normalizeCampSessionRecord,
} from "./campOfferModel";
import { mergeCampSessionsForPublished } from "@/lib/offers/offerPublishedEditGate";

// продолжительность считается по датам: дни включают оба края, ночи — только у выездных
assert.deepEqual(campShiftDuration("2026-10-26", "2026-10-30", false), { days: 5, nights: 0 });
assert.deepEqual(campShiftDuration("2026-12-29", "2027-01-04", true), { days: 7, nights: 6 });
assert.deepEqual(campShiftDuration("2026-10-26", "2026-10-26", true), { days: 1, nights: 0 });
assert.equal(campShiftDuration("2026-10-30", "2026-10-26", false), null);
assert.equal(campShiftDuration(null, "2026-10-26", false), null);
assert.equal(formatCampShiftDuration({ days: 5, nights: 0 }), "5 дней");
assert.equal(formatCampShiftDuration({ days: 7, nights: 6 }), "7 дней · 6 ночей");
assert.equal(formatCampShiftDuration({ days: 2, nights: 1 }), "2 дня · 1 ночь");
assert.equal(formatCampShiftDuration({ days: 22, nights: 21 }), "22 дня · 21 ночь");

// у смены обязательны название, даты и цена
const shift = createEmptyCampSession(0);
assert.deepEqual(getCampShiftMissingFields(shift), ["Название", "Даты", "Цена"]);
shift.title = "«Юные изобретатели»";
shift.dateFrom = "2026-10-26";
shift.dateTo = "2026-10-30";
shift.priceOverride = "450";
assert.deepEqual(getCampShiftMissingFields(shift), []);
assert.deepEqual(getCampShiftMissingFields({ ...shift, dateFrom: "2026-11-01" }), ["Даты (конец раньше начала)"]);
assert.deepEqual(getCampShiftMissingFields({ ...shift, priceOverride: "abc" }), ["Цена"]);
assert.deepEqual(getCampShiftMissingFields({ ...shift, priceOverride: "0" }), []);

// новые поля смены переживают чтение из БД; старые смены получают пустые значения
const restored = normalizeCampSessionRecord({ id: "s1", includes: "Питание", baseLocation: "База «Лесная»" }, 0);
assert.equal(restored.includes, "Питание");
assert.equal(restored.baseLocation, "База «Лесная»");
assert.equal(normalizeCampSessionRecord({ id: "s2" }, 1).includes, "");

// опубликованный лагерь: даты/цена/места — сразу, а «что входит» и база — контент (ревизия)
const live = [{ id: "s1", title: "Июнь", dateFrom: "2026-06-01", dateTo: "2026-06-07", priceOverride: "500", includes: "Питание" }];
const operational = mergeCampSessionsForPublished(live, [{ ...live[0], priceOverride: "550", capacity: 20 }]);
assert.equal(operational.contentChanged, false);
assert.equal((operational.merged[0] as { priceOverride?: string }).priceOverride, "550");
const content = mergeCampSessionsForPublished(live, [{ ...live[0], includes: "Питание и экскурсии" }]);
assert.equal(content.contentChanged, true);
assert.equal((content.merged[0] as { includes?: string }).includes, "Питание");
assert.equal(mergeCampSessionsForPublished(live, [{ ...live[0], baseLocation: "Новая база" }]).contentChanged, true);

console.log("campShift tests passed");
