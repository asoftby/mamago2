/**
 * Disposable PostgreSQL only. Never run against DEV or PROD.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createRecurringTaskSeries } from "./recurringTask.service";

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
