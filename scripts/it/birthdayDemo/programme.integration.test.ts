import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import appPrisma, { prismaBase } from '../../../src/lib/prisma';
import { assertBirthdayDemoEnvironment } from './guard';
import { seedBirthdayDemo } from './seed';
import { demoId, demoDates } from './catalog';
import { changePartyProgramme, readFamilyPartyProgramme, readPublicPartyProgramme } from '../../../src/server/birthday/partyPlan.service';
import { createPartyDraft, updatePartyDraft, readPartyOrder } from '../../../src/server/birthday/partyDraft.service';
import { planScopeFor } from '../../../src/server/family/familyAccess';
import { removePlanItem, listPlanItemsByDate } from '../../../src/server/services/plan.service';
import { cancelPartyBeforeConfirmation } from '../../../src/server/birthday/partyCancel.service';

assertBirthdayDemoEnvironment(process.env);
process.env.FAMILY_CORE_READS = '1';
const db = new PrismaClient();
let queryCount = 0;
if (process.env.PRISMA_QUERY_EVENTS === '1') prismaBase.$on('query' as never, (() => { queryCount++; }) as never);
const parent = demoId('parent'), adult = demoId('adult'), outsider = demoId('outsider');
async function main() {
  await seedBirthdayDemo(db);
  const draft = await createPartyDraft(parent, { citySlug: 'minsk', venueMode: 'VENUE' });
  try {
    const party = await updatePartyDraft(parent, draft.id, { version: draft.version, eventDate: demoDates().partyDate,
      timeFrom: '14:00', timeTo: '16:00', anchorOfferId: demoId('venue-1'), addonOfferIds: [demoId('animator-1')] });
    const entries = party.items.map(item => ({ itemId: item.id, from: '14:15', to: '15:00' }));
    await assert.rejects(changePartyProgramme(outsider, party.id, { action: 'saveToPlan', version: party.version }), /не найден/);
    const concurrent = await Promise.allSettled([1, 2].map(() => changePartyProgramme(parent, party.id,
      { action: 'programme', version: party.version, entries })));
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(result => result.status === 'rejected').length, 1);
    let version = party.version + 1;
    await assert.rejects(updatePartyDraft(parent, party.id, { version, timeFrom: '15:30' }), /внутри согласованного/);
    assert.equal((await readPartyOrder(parent, party.id)).version, version);

    await assert.rejects(changePartyProgramme(parent, party.id, { action: 'participants', version, adultIds: [outsider], childIds: [] }), /действующих/);
    await assert.rejects(changePartyProgramme(parent, party.id, { action: 'participants', version, adultIds: [adult], childIds: [demoId('other-child')] }), /ребёнка/);
    await changePartyProgramme(parent, party.id, { action: 'participants', version: version++, adultIds: [parent], childIds: [demoId('child')] });
    await changePartyProgramme(parent, party.id, { action: 'saveToPlan', version: version++ });
    const selfOnly = await db.partyOrder.findUniqueOrThrow({ where: { id: party.id }, select: { programmeAdultIds: true, planItem: { select: { visibility: true } } } });
    assert.deepEqual(selfOnly.programmeAdultIds, [parent]);
    assert.equal(selfOnly.planItem?.visibility, 'PRIVATE');
    assert.equal(await readFamilyPartyProgramme(adult, party.id), null, 'self participation is not family sharing');
    await changePartyProgramme(parent, party.id, { action: 'participants', version: version++, adultIds: [adult], childIds: [demoId('child')] });
    await changePartyProgramme(parent, party.id, { action: 'saveToPlan', version: version++ });
    const linked = await db.partyOrder.findUniqueOrThrow({ where: { id: party.id } });
    assert.ok(linked.planItemId);
    await changePartyProgramme(parent, party.id, { action: 'saveToPlan', version: version++ });
    assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: party.id } })).planItemId, linked.planItemId);
    assert.equal(await db.planItem.count({ where: { partyOrder: { id: party.id } } }), 1);
    const familyProgramme = await readFamilyPartyProgramme(adult, party.id);
    assert.ok(familyProgramme);
    assert.equal(await readFamilyPartyProgramme(outsider, party.id), null);
    const list = await listPlanItemsByDate(adult, demoDates().partyDate);
    assert.equal(list.find(row => row.id === linked.planItemId)?.partyOrder?.id, party.id);
    await removePlanItem(adult, linked.planItemId!);
    assert.ok(await db.planItem.findUnique({ where: { id: linked.planItemId! } }));
    // Normal private family tasks never become accessible through programme selection.
    const privateTask = await db.planItem.create({ data: { userId: parent, familyId: demoId('family'), visibility: 'PRIVATE', source: 'MANUAL', entryType: 'TASK', title: 'PRIVATE_SECRET' } });
    try { assert.equal(await db.planItem.findFirst({ where: { id: privateTask.id, ...(await planScopeFor(adult)) } }), null); }
    finally { await db.planItem.delete({ where: { id: privateTask.id } }); }
    await changePartyProgramme(parent, party.id, { action: 'publicLink', version: version++, days: 1 });
    const enabled = await db.partyOrder.findUniqueOrThrow({ where: { id: party.id } });
    assert.ok(enabled.publicPlanToken);
    queryCount = 0;
    const publicView = await readPublicPartyProgramme(enabled.publicPlanToken!);
    if (process.env.PRISMA_QUERY_EVENTS === '1') {
      console.log('MEASURE public programme SQL:', queryCount, 'response bytes:', Buffer.byteLength(JSON.stringify(publicView)));
      assert.ok(queryCount <= 4, 'bounded reads independent of number of services');
    }
    assert.deepEqual(publicView, familyProgramme);
    assert.doesNotMatch(JSON.stringify(publicView), /birthday-demo|Тестовый|contact|price|publicPlanToken/);
    await db.partyOrder.update({ where: { id: party.id }, data: { publicPlanExpiresAt: new Date(0) } });
    assert.equal(await readPublicPartyProgramme(enabled.publicPlanToken!), null);
    await changePartyProgramme(parent, party.id, { action: 'publicLink', version: version++, days: 7 });
    assert.equal(await readPublicPartyProgramme(enabled.publicPlanToken!), null, 'rotation invalidates old capability');
    const rotated = await db.partyOrder.findUniqueOrThrow({ where: { id: party.id } });
    await changePartyProgramme(parent, party.id, { action: 'publicLink', version: version++, days: 0 });
    assert.equal(await readPublicPartyProgramme(rotated.publicPlanToken!), null);
    await db.familyMembership.update({ where: { id: demoId('member-adult') }, data: { leftAt: new Date() } });
    try { assert.equal(await readFamilyPartyProgramme(adult, party.id), null); }
    finally { await db.familyMembership.update({ where: { id: demoId('member-adult') }, data: { leftAt: null } }); }
    await db.familyMembership.update({ where: { id: demoId('member-parent') }, data: { leftAt: new Date() } });
    try { assert.equal(await readFamilyPartyProgramme(adult, party.id), null, 'owner leaving revokes old family access'); }
    finally { await db.familyMembership.update({ where: { id: demoId('member-parent') }, data: { leftAt: null } }); }
    await updatePartyDraft(parent, party.id, { version: version++, timeFrom: '14:10', timeTo: '16:00' });
    assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: linked.planItemId! } })).startsAt?.toISOString().slice(11, 16), '11:10');
    assert.deepEqual((await readPartyOrder(parent, party.id)).programme, entries);
    await cancelPartyBeforeConfirmation(parent, party.id, version);
    assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: linked.planItemId! } })).status, 'CANCELLED');
    console.log('programme integration PASS: CAS, ACL, participants, one PlanItem, reload, public redaction/expiry/rotation/revoke, family leave, private tasks, draft date sync, cancellation');
  } finally {
    const order = await db.partyOrder.findUnique({ where: { id: draft.id }, select: { planItemId: true } });
    await db.partyOrder.deleteMany({ where: { id: draft.id, ownerUserId: parent } });
    if (order?.planItemId) await db.planItem.deleteMany({ where: { id: order.planItemId, userId: parent } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); await appPrisma.$disconnect(); });
