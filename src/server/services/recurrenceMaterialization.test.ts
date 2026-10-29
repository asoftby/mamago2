import assert from "node:assert/strict";
import { planRecurrenceInsertRows } from "./recurrenceMaterialization.service";
const series = {
  id:"s1",ownerUserId:"u1",familyId:"f1",visibility:"FAMILY" as const,
  frequency:"DAILY" as const,interval:1,startDate:"2026-10-29",
  untilDate:null,maxOccurrences:3,weekdays:[],
  template:{title:"Ежедневное дело",time:"16:30",reminderEnabled:true,lead:60},
};
const rows=planRecurrenceInsertRows([series],"2026-10-29","2026-11-10");
assert.deepEqual(rows.map(x=>x.recurrenceDate),["2026-10-29","2026-10-30","2026-10-31"]);
assert.equal(rows[0]?.reminderLeadMinutes,60);
assert.equal(rows[0]?.recurrenceSeriesId,"s1");
assert.equal(rows[0]?.visibility,"FAMILY");
assert.throws(()=>planRecurrenceInsertRows([series],"2026-10-29","2027-11-01"),/invalid_window/);

// A large set of daily series must honor the insertion budget without throwing.
const many = Array.from({ length: 100 }, (_, index) => ({
  ...series,
  id: `s-${index}`,
  maxOccurrences: null,
}));
const boundedRows = planRecurrenceInsertRows(many, "2026-10-29", "2026-11-28");
assert.equal(boundedRows.length, 2000);
assert.ok(boundedRows.length <= 2000);
