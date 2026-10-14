import assert from "node:assert/strict";
import { nextWeekendDates, isWeekendDateInWindow, findWeekendConflicts, type WeekendPlanEntry, type WeekendStop } from "./weekendRules";

assert.deepEqual(nextWeekendDates("2026-10-13"), ["2026-10-17", "2026-10-18"]);
assert.deepEqual(nextWeekendDates("2026-10-18"), ["2026-10-24", "2026-10-25"]);
assert.equal(isWeekendDateInWindow("2026-10-17", "2026-10-13"), true);
assert.equal(isWeekendDateInWindow("2026-10-19", "2026-10-13"), false);
assert.equal(isWeekendDateInWindow("2026-10-10", "2026-10-13"), false);
assert.equal(isWeekendDateInWindow("2026-10-32", "2026-10-13"), false);
const plan: WeekendPlanEntry[] = [
  { id:"doctor", title:"Врач", startsAt:"2026-10-17T07:00:00Z", endsAt:"2026-10-17T08:00:00Z", noteWithoutTime:false, kind:"task", activityId:null, placeId:null },
  { id:"todo", title:"Купить подарок", startsAt:null, endsAt:null, noteWithoutTime:true, kind:"task", activityId:null, placeId:null },
];
const candidate: WeekendStop = { key:"activity:x", kind:"activity", id:"x", title:"Музей", description:"", href:"/minsk/events/x", imageUrl:null, address:null, startsAt:"2026-10-17T07:30:00Z", sessionId:null, rating:null, coords:null, reason:"" };
assert.deepEqual(findWeekendConflicts(candidate, plan), [{ planId:"doctor", planTitle:"Врач", severity:"conflict" }]);
assert.deepEqual(findWeekendConflicts({ ...candidate, startsAt:null }, plan), []);
assert.deepEqual(findWeekendConflicts({ ...candidate, startsAt:"2026-10-17T10:00:00Z" }, plan), []);
console.log("Weekend planner rules: PASS");
