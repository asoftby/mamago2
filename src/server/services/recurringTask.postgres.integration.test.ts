/**
 * Disposable PostgreSQL only. Never run against DEV or PROD.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createRecurringTaskSeries, cancelRecurringTaskSeries } from "./recurringTask.service";
import { materializeRecurrencesForRange } from "./recurrenceMaterialization.service";
import { familyIdForWrite } from "@/server/family/familyAccess";

const raw = process.env.DATABASE_URL ?? "";
let url: URL;
try { url = new URL(raw); } catch { throw Error("recurrence_it_requires_disposable_db"); }
if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55444" || url.pathname !== "/mamago_recurrence_it") {
  throw Error("recurrence_it_only_allows_localhost_55444_mamago_recurrence_it");
}

const db = new PrismaClient();
after(async () => db.$disconnect());
const base = {title: "Weekly class", startTime:"16:30", reminderEnabled:true, reminderLeadMinutes:60, recurrence:{frequency:"WEEKLY",interval:1,startDate:"2026-10-29",weekdays:[4]}} as const;

async function fixture() {
  const user = await db.user.create({ data: { email: "recurrence-"+randomUUID()+"@example.test" } });
  return { userId: user.id };
}
async function checkCounts(key: string, expected = 1) {
  const series = await db.planRecurrenceSeries.findUniqueOrThrow({where:{requestKey:key}});
  assert.equal(await db.planRecurrenceSeries.count({where:{requestKey:key}}), expected);
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:series.id}}), expected);
  return series.id;
}

test("two parallel retries create exactly one series and occurrence", async () => {
  const owner = await fixture(), key = "repeat_"+randomUUID().replaceAll("-","");
  const result = await Promise.all([createRecurringTaskSeries(owner,{...base,requestKey:key}),createRecurringTaskSeries(owner,{...base,requestKey:key})]);
  assert.equal(result[0],result[1]);
  assert.equal(result[0],await checkCounts(key));
});
test("ten parallel retries create exactly one series and occurrence", async () => {
  const owner = await fixture(), key = "repeat_"+randomUUID().replaceAll("-","");
  const ids = await Promise.all(Array.from({length:10},()=>createRecurringTaskSeries(owner,{...base,requestKey:key})));
  assert.equal(new Set(ids).size,1);
  assert.equal(ids[0],await checkCounts(key));
});
test("repeat after commit returns existing ID", async () => {
  const owner = await fixture(), key = "repeat_"+randomUUID().replaceAll("-","");
  const first=await createRecurringTaskSeries(owner,{...base,requestKey:key});
  assert.equal(await createRecurringTaskSeries(owner,{...base,requestKey:key}),first);
  await checkCounts(key);
});
test("same key with changed rule rejects without duplicate", async () => {
  const owner = await fixture(), key = "repeat_"+randomUUID().replaceAll("-","");
  await createRecurringTaskSeries(owner,{...base,requestKey:key});
  await assert.rejects(createRecurringTaskSeries(owner,{...base,requestKey:key,recurrence:{...base.recurrence,interval:2}}),/idempotency_conflict/);
  await checkCounts(key);
});
test("different keys create independent series", async () => {
  const owner = await fixture();
  const ids=await Promise.all(Array.from({length:2},()=>createRecurringTaskSeries(owner,{...base,requestKey:"repeat_"+randomUUID().replaceAll("-","")})));
  assert.equal(new Set(ids).size,2);
});
test("different user cannot reuse another user's key", async () => {
  const one=await fixture(), two=await fixture(), key="repeat_"+randomUUID().replaceAll("-","");
  await createRecurringTaskSeries(one,{...base,requestKey:key});
  await assert.rejects(createRecurringTaskSeries(two,{...base,requestKey:key}),/idempotency_conflict/);
  await checkCounts(key);
});
test("failed first occurrence rolls back series", async () => {
  const owner=await fixture(), key="repeat_"+randomUUID().replaceAll("-","");
  // An invalid timestamp is rejected by PostgreSQL/Prisma while writing the first item,
  // *after* the series insert, proving transactional rollback.
  await assert.rejects(createRecurringTaskSeries(owner,{...base,requestKey:key,startTime:"02:99"}),/invalid_start_time/);
  assert.equal(await db.planRecurrenceSeries.count({where:{requestKey:key}}),0);
});

test("recurring child assignment verifies family ownership and persists", async () => {
  const owner=await fixture();
  const familyId=await familyIdForWrite(owner.userId);
  const child=await db.child.create({data:{name:"Child test",parentId:owner.userId,familyId}});
  const id=await createRecurringTaskSeries(owner,{
    ...base,requestKey:"repeat_"+randomUUID().replaceAll("-",""),childId:child.id,
  });
  const item=await db.planItem.findFirstOrThrow({where:{recurrenceSeriesId:id}});
  assert.equal(item.childId,child.id);

  const other=await fixture();
  const wrongChild=await db.child.create({data:{name:"Other child",parentId:other.userId,
    familyId:await familyIdForWrite(other.userId)}});
  await assert.rejects(createRecurringTaskSeries(owner,{
    ...base,requestKey:"repeat_"+randomUUID().replaceAll("-",""),childId:wrongChild.id,
  }),/child_not_found/);
});

test("stop this-and-following keeps earlier days, cancels materialized future and never recreates", async () => {
  const owner=await fixture(), key="repeat_"+randomUUID().replaceAll("-","");
  const id=await createRecurringTaskSeries(owner,{
    ...base,requestKey:key,
    recurrence:{frequency:"DAILY",interval:1,startDate:"2026-10-29"},
  });
  await materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05");
  const target=await db.planItem.findFirstOrThrow({where:{recurrenceSeriesId:id,recurrenceDate:"2026-11-02"}});
  await cancelRecurringTaskSeries(owner,target.id,"FUTURE",target.updatedAt.toISOString());
  const earlier=await db.planItem.findMany({where:{recurrenceSeriesId:id,recurrenceDate:{lt:"2026-11-02"}}});
  assert.equal(earlier.length,4);
  assert.ok(earlier.every(item=>item.status==="CONFIRMED"));
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,recurrenceDate:{gte:"2026-11-02"},status:"CONFIRMED"}}),0);
  await materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05");
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,recurrenceDate:{gte:"2026-11-02"},status:"CONFIRMED"}}),0);
  const series=await db.planRecurrenceSeries.findUniqueOrThrow({where:{id}});
  assert.equal(series.untilDate,"2026-11-01");
  await assert.rejects(cancelRecurringTaskSeries(owner,target.id,"FUTURE",target.updatedAt.toISOString()),/recurrence_not_found/);
});

test("whole series cancels all materialized days and prevents future generation", async () => {
  const owner=await fixture();
  const id=await createRecurringTaskSeries(owner,{
    ...base,requestKey:"repeat_"+randomUUID().replaceAll("-",""),
    recurrence:{frequency:"DAILY",interval:1,startDate:"2026-10-29"},
  });
  await materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05");
  const target=await db.planItem.findFirstOrThrow({where:{recurrenceSeriesId:id}});
  await cancelRecurringTaskSeries(owner,target.id,"ALL",target.updatedAt.toISOString());
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,status:"CONFIRMED"}}),0);
  assert.ok((await db.planRecurrenceSeries.findUniqueOrThrow({where:{id}})).stoppedAt);
  await materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05");
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,status:"CONFIRMED"}}),0);
});

test("unrelated account cannot cancel another user's recurrence", async () => {
  const owner=await fixture(), stranger=await fixture();
  const id=await createRecurringTaskSeries(owner,{...base,requestKey:"repeat_"+randomUUID().replaceAll("-","")});
  const item=await db.planItem.findFirstOrThrow({where:{recurrenceSeriesId:id}});
  await assert.rejects(cancelRecurringTaskSeries(stranger,item.id,"ALL",item.updatedAt.toISOString()),/recurrence_not_found/);
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,status:"CONFIRMED"}}),1);
});

test("concurrent calendar materialization and series cancellation never resurrect future days", async () => {
  const owner=await fixture();
  const id=await createRecurringTaskSeries(owner,{
    ...base,requestKey:"repeat_"+randomUUID().replaceAll("-",""),
    recurrence:{frequency:"DAILY",interval:1,startDate:"2026-10-29"},
  });
  const first=await db.planItem.findFirstOrThrow({where:{recurrenceSeriesId:id}});
  const result=await Promise.allSettled([
    ...Array.from({length:5},()=>materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05")),
    cancelRecurringTaskSeries(owner,first.id,"FUTURE",first.updatedAt.toISOString()),
  ]);
  assert.ok(result.every(item=>item.status==="fulfilled"),JSON.stringify(result.filter(x=>x.status==="rejected")));
  await materializeRecurrencesForRange(owner,"2026-10-29","2026-11-05");
  assert.equal(await db.planItem.count({where:{recurrenceSeriesId:id,status:"CONFIRMED"}}),0);
});

test("deleted child never breaks recurrence materialization or future calendar reads", async () => {
  const owner=await fixture();
  const familyId=await familyIdForWrite(owner.userId);
  const child=await db.child.create({data:{name:"Child removed",parentId:owner.userId,familyId}});
  const id=await createRecurringTaskSeries(owner,{
    ...base,requestKey:"repeat_"+randomUUID().replaceAll("-",""),childId:child.id,
    recurrence:{frequency:"DAILY",interval:1,startDate:"2026-10-29"},
  });
  await db.child.delete({where:{id:child.id}});
  await materializeRecurrencesForRange(owner,"2026-11-01","2026-11-04");
  const future=await db.planItem.findMany({where:{recurrenceSeriesId:id,recurrenceDate:{gte:"2026-11-01"}}});
  assert.equal(future.length,4);
  assert.ok(future.every(item=>item.childId===null));
});
