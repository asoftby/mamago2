import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { familyIdForWrite, familyReadsEnabled, planScopeFor } from "@/server/family/familyAccess";
import { generateShareToken, SHARE_TOKEN_PATTERN } from "@/server/wishlist/wishlistPure";
import { projectProgramme, validateProgramme, type ProgrammeCommand } from "@/lib/birthday/partyProgramme";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";

export const programmeSelect = {
  status: true, eventDate: true, timeFrom: true, timeTo: true, programme: true,
  items: { orderBy: { position: "asc" }, select: {
    id: true, category: true, role: true, parentItemId: true, status: true, position: true, packageComponentChange: true,
    serviceStart: true, serviceEnd: true,
    requests: { orderBy: { createdAt: "desc" }, take: 1, select: {
      partyStage: true, partyQuotes: { orderBy: { version: "desc" }, take: 1,
        select: { status: true, validUntil: true } },
    } },
  } },
} as const satisfies Prisma.PartyOrderSelect;

/** A5's single linked projection: no copied programme/price or confirmation state.
 * Called inside the transaction that owns the order version. */
export async function createPartyPlan(tx: Prisma.TransactionClient, party: {
  id: string; ownerUserId: string; familyId: string | null; planItemId: string | null;
  eventDate: Date | null; timeFrom: string | null; timeTo: string | null;
  programmeAdultIds: string[]; programmeChildIds: string[];
}) {
  if (!party.eventDate || !party.timeFrom || !party.timeTo)
    throw new PartyApiError(422, "Сначала укажите дату и время праздника");
  const familyId = party.familyId;
  if (!familyId) throw new PartyApiError(409, "Семья изменилась. Обновите страницу");
  const data = { userId: party.ownerUserId, familyId,
    visibility: party.programmeAdultIds.some(id => id !== party.ownerUserId) ? "FAMILY" as const : "PRIVATE" as const,
    source: "MANUAL" as const, entryType: "EVENT" as const,
    date: party.eventDate.toISOString().slice(0, 10), startsAt: partyStartAt(party.eventDate, party.timeFrom),
    endsAt: partyStartAt(party.eventDate, party.timeTo), title: "День рождения",
    childId: party.programmeChildIds[0] ?? null,
    notes: "Программа и актуальные ответы исполнителей — в празднике", priceAmount: null,
    reminderEnabled: false,
  };
  if (party.planItemId) {
    await tx.planItem.update({ where: { id: party.planItemId }, data });
    return party.planItemId;
  }
  const plan = await tx.planItem.create({ data, select: { id: true } });
  await tx.partyOrder.update({ where: { id: party.id }, data: { planItemId: plan.id, familyId } });
  return plan.id;
}

export async function changePartyProgramme(ownerUserId: string, partyId: string, input: ProgrammeCommand) {
  // Reuse Family Core's lazy first-write path, like the existing manual plan writer.
  const planFamilyId = input.action === "saveToPlan" ? await familyIdForWrite(ownerUserId) : null;
  return prisma.$transaction(async tx => {
    const party = await tx.partyOrder.findFirst({ where: { id: partyId, ownerUserId },
      select: { ...programmeSelect, items: input.action === "programme" ? programmeSelect.items : false, id: true, version: true, ownerUserId: true, familyId: true,
        planItemId: true, programmeAdultIds: true, programmeChildIds: true } });
    if (!party) throw new PartyApiError(404, "Праздник не найден");
    if (party.version !== input.version) throw new PartyApiError(409, "Праздник изменён. Обновите страницу");
    if (party.status === "CANCELLED") throw new PartyApiError(409, "Праздник отменён");
    let nextAdults = party.programmeAdultIds;
    let nextChildren = party.programmeChildIds;
    let participantsReset = false;
    const data: Prisma.PartyOrderUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (input.action === "programme") {
      const error = validateProgramme(input.entries, party);
      if (error) throw new PartyApiError(422, error);
      data.programme = input.entries;
    }
    if (input.action === "participants") {
      if (!familyReadsEnabled()) throw new PartyApiError(409, "Семейный доступ пока недоступен");
      // Serialize with canonical family leave/invite operations before validating all participants.
      const membership = await tx.familyMembership.findFirst({ where: { userId: ownerUserId, leftAt: null }, select: { familyId: true } });
      if (!membership) throw new PartyApiError(422, "Семья не найдена");
      await tx.$queryRaw`SELECT "id" FROM "Family" WHERE "id" = ${membership.familyId} FOR UPDATE`;
      const members = await tx.familyMembership.findMany({ where: { familyId: membership.familyId, leftAt: null }, select: { userId: true } });
      const adults = [...new Set(input.adultIds)];
      if (!members.some(row => row.userId === ownerUserId) || adults.some(id => !members.some(row => row.userId === id)))
        throw new PartyApiError(422, "Можно выбрать только действующих участников семьи");
      const children = [...new Set(input.childIds)];
      const count = await tx.child.count({ where: { familyId: membership.familyId, id: { in: children } } });
      if (count !== children.length) throw new PartyApiError(422, "Профиль ребёнка недоступен");
      data.familyId = membership.familyId;
      data.programmeAdultIds = nextAdults = adults;
      data.programmeChildIds = nextChildren = children;
    }
    if (input.action === "saveToPlan" && planFamilyId) {
      await tx.$queryRaw`SELECT "id" FROM "Family" WHERE "id" = ${planFamilyId} FOR UPDATE`;
      const members = await tx.familyMembership.findMany({ where: {
        familyId: planFamilyId, leftAt: null, userId: { in: [...new Set([ownerUserId, ...nextAdults])] },
      }, select: { userId: true } });
      if (!members.some(row => row.userId === ownerUserId))
        throw new PartyApiError(409, "Семья изменилась. Обновите страницу");
      if (party.familyId !== planFamilyId) {
        participantsReset = nextAdults.length > 0 || nextChildren.length > 0;
        nextAdults = []; nextChildren = [];
      } else {
        const activeIds = new Set(members.map(row => row.userId));
        const children = nextChildren.length ? await tx.child.findMany({ where: {
          familyId: planFamilyId, id: { in: nextChildren },
        }, select: { id: true } }) : [];
        const childIds = new Set(children.map(row => row.id));
        const adults = nextAdults.filter(id => activeIds.has(id));
        const currentChildren = nextChildren.filter(id => childIds.has(id));
        participantsReset = adults.length !== nextAdults.length || currentChildren.length !== nextChildren.length;
        nextAdults = adults; nextChildren = currentChildren;
      }
      data.familyId = planFamilyId;
      if (participantsReset) {
        data.programmeAdultIds = nextAdults;
        data.programmeChildIds = nextChildren;
      }
    }
    if (input.action === "publicLink") {
      data.publicPlanToken = input.days ? generateShareToken() : null;
      data.publicPlanExpiresAt = input.days ? new Date(Date.now() + input.days * 86400000) : null;
    }
    const changed = await tx.partyOrder.updateMany({ where: { id: partyId, ownerUserId, version: input.version }, data });
    if (!changed.count) throw new PartyApiError(409, "Праздник изменён. Обновите страницу");
    if (input.action === "saveToPlan" || (input.action === "participants" && party.planItemId)) {
      await createPartyPlan(tx, { ...party,
        familyId: typeof data.familyId === "string" ? data.familyId : party.familyId,
        programmeAdultIds: nextAdults,
        programmeChildIds: nextChildren,
      });
    }
    return { version: input.version + 1, participantsReset };
  });
}

export async function readPublicPartyProgramme(token: string) {
  if (!SHARE_TOKEN_PATTERN.test(token)) return null;
  const party = await prisma.partyOrder.findFirst({ where: { publicPlanToken: token,
    publicPlanExpiresAt: { gt: new Date() }, status: { not: "CANCELLED" } }, select: programmeSelect });
  return party ? projectProgramme(party) : null;
}

/** Never returns the private order DTO to family readers. Family Core scope includes
 * history boundaries, selected participants and active owner membership. */
export async function readFamilyPartyProgramme(userId: string, id: string) {
  if (!familyReadsEnabled()) return null;
  const plan = await prisma.planItem.findFirst({ where: { ...(await planScopeFor(userId)),
    partyOrder: { id } }, select: { partyOrder: { select: programmeSelect } } });
  return plan?.partyOrder ? projectProgramme(plan.partyOrder) : null;
}
