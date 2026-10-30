/**
 * Сеансы Telegram-постов в одном событии (нужна БД; гоняется через gate-env.sh).
 * Пост описывает только свою часть графика: применение второго поста не должно
 * отзывать сеансы первого, а чужие сеансы (ABWS) не затрагиваются вовсе.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import prisma from "@/lib/prisma";
import { upsertActivitySessionsFromOccurrences } from "../publish/activity-session-from-occurrences";

const tag = randomUUID().slice(0, 8);
const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
let activityId = "";
let userId = "";

after(async () => {
  if (activityId) await prisma.activity.delete({ where: { id: activityId } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

test("a second post does not withdraw the first post's sessions; ABWS sessions stay untouched", async () => {
  userId = (await prisma.user.create({ data: { email: `tg-scope-${tag}@example.invalid` }, select: { id: true } })).id;
  activityId = (
    await prisma.activity.create({
      data: {
        ownerUserId: userId, title: `Scope ${tag}`, shortDesc: "fixture", type: "EVENT", status: "PUBLISHED",
        scheduleMode: "MULTI_DATE", schedulingKind: "SLOT", scheduleJson: { durationMinutes: 60 },
      },
      select: { id: true },
    })
  ).id;

  const iso = (days: number) => future(days).toISOString();
  // Post A contributes two sessions, an ABWS session exists too.
  await upsertActivitySessionsFromOccurrences(
    activityId,
    [{ externalId: `chan_${tag}/1#1`, startAt: iso(3) }, { externalId: `chan_${tag}/1#2`, startAt: iso(4) }],
    { source: "telegram", externalIdPrefix: `chan_${tag}/1#` },
  );
  await prisma.activitySession.create({ data: { activityId, startsAt: future(1), source: "abws-performances-event", externalId: `abws-${tag}` } });

  // Post B is applied to the same event with its own sessions.
  await upsertActivitySessionsFromOccurrences(
    activityId,
    [{ externalId: `chan_${tag}/2#1`, startAt: iso(10) }, { externalId: `chan_${tag}/2#2`, startAt: iso(11) }],
    { source: "telegram", externalIdPrefix: `chan_${tag}/2#` },
  );

  const active = async () =>
    (await prisma.activitySession.findMany({ where: { activityId, withdrawnAt: null }, select: { externalId: true } }))
      .map((s) => s.externalId).sort();
  assert.deepEqual(await active(), [`abws-${tag}`, `chan_${tag}/1#1`, `chan_${tag}/1#2`, `chan_${tag}/2#1`, `chan_${tag}/2#2`].sort(),
    "post A's sessions survive the application of post B");

  // Post B is edited and drops its second session: only B's own session is withdrawn.
  await upsertActivitySessionsFromOccurrences(
    activityId,
    [{ externalId: `chan_${tag}/2#1`, startAt: iso(10) }],
    { source: "telegram", externalIdPrefix: `chan_${tag}/2#` },
  );
  assert.deepEqual(await active(), [`abws-${tag}`, `chan_${tag}/1#1`, `chan_${tag}/1#2`, `chan_${tag}/2#1`].sort());

  // nextOccurrenceAt is the nearest active session of the whole event, not of the last post.
  const next = (await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, select: { nextOccurrenceAt: true } })).nextOccurrenceAt!;
  const abws = await prisma.activitySession.findFirstOrThrow({ where: { activityId, source: "abws-performances-event" } });
  assert.equal(next.getTime(), abws.startsAt.getTime(), "the earliest remaining session wins, whichever source owns it");
});
