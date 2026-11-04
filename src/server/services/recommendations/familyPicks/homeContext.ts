import "server-only";
import { ageMonthsIntervalAt, ageYearsAt } from "@/lib/child/birth";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { activePlanScopeFor, familyReadsEnabled, childScopeFor } from "@/server/family/familyAccess";
import { ageFilterKeysForChildren } from "./select";
import { loadFamilyPicksProfile, type FamilyPicksProfile } from "./profile";
import { PERSONAL_FAMILY_PICKS_POLICY } from "./config";
import { minskDateKey } from "./window";
import type { HomeFamilyContext } from "@/features/city-home/lib/familyHome";

export async function loadHomeContext(userId: string | null, snapshot?: FamilyPicksProfile) {
  const profile = snapshot ?? await loadFamilyPicksProfile(userId);
  if (profile.userId !== userId) throw new Error("profile_actor_mismatch");
  const now = new Date();
  const [membership, dismiss, plan] = userId ? await Promise.all([
    familyReadsEnabled() ? prisma.familyMembership.findFirst({ where: { userId, leftAt: null },
      select: { id: true, familyId: true, joinedAt: true,
        family: { select: { memberships: { where: { leftAt: null }, orderBy: { joinedAt: "asc" }, take: 10,
          select: { userId: true, user: { select: { displayName: true } } } } } } } }) : null,
    prisma.userEvent.aggregate({ where: { userId, eventType: "DISMISS", entityType: "EVENT" }, _max: { createdAt: true }, _count: true }),
    prisma.planItem.aggregate({ where: await activePlanScopeFor(userId), _max: { updatedAt: true }, _count: true }),
  ]) : [null, null, null];
  const children = [...profile.children].sort((a, b) => a.id.localeCompare(b.id));
  const day = minskDateKey(now);
  const signature = createHash("sha256").update(JSON.stringify({ userId, membership, reads: familyReadsEnabled(), children: children.map(child => ({ ...child, systemInterests: child.systemInterests.map(i => i.interestSlug).sort() })), day, dismiss, plan })).digest("hex");
  const context: HomeFamilyContext = {
    actorId: userId, signature, day, policyVersion: PERSONAL_FAMILY_PICKS_POLICY.version,
    audience: profile.audience, selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
    adults: (membership?.family.memberships ?? []).filter(member => member.userId !== userId)
      .map(member => ({ name: member.user.displayName, isMe: false })),
    children: children.map(child => ({ id: child.id, name: child.name, hasBirthDate: Boolean(child.birthDate),
      ageYears: ageYearsAt(child, new Date(day + "T12:00:00Z")),
      ageMonths: ageMonthsIntervalAt(child, new Date(day + "T12:00:00Z"))?.min ?? null,
      ageFilter: (() => {
        const range = ageMonthsIntervalAt(child, new Date(`${day}T00:00:00Z`));
        return range ? ageFilterKeysForChildren([{ ageMonths: range.min }, { ageMonths: range.max }]) : [];
      })() })),
  };
  if (userId) {
    const preference = await prisma.userHomePreference.findUnique({ where: { userId } });
    const selected = preference?.selectedChildId ?? null;
    if (selected && !children.some(child => child.id === selected)) {
      await prisma.userHomePreference.updateMany({ where: { userId, selectedChildId: selected, updatedAt: preference!.updatedAt }, data: { selectedChildId: null } });
      const reset = await prisma.userHomePreference.findUnique({ where: { userId } });
      context.selectedChildId = reset?.selectedChildId && children.some(child => child.id === reset.selectedChildId) ? reset.selectedChildId : null;
      context.preferenceVersion = reset?.updatedAt.toISOString() ?? null;
    } else {
      context.selectedChildId = selected;
      context.preferenceVersion = preference?.updatedAt.toISOString() ?? null;
    }
  }
  return { profile, context };
}


/** Optimistic revision: late requests/devices cannot silently overwrite a newer choice. */
export async function saveHomeSelection(userId: string, selectedChildId: string | null, version: string | null) {
  if (selectedChildId && !await prisma.child.findFirst({ where: { AND: [{ id: selectedChildId }, await childScopeFor(userId)] }, select: { id: true } })) {
    throw new Error("selection_unavailable");
  }
  if (version === null) {
    try { await prisma.userHomePreference.create({ data: { userId, selectedChildId } }); return true; }
    catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2002") return false; throw error; }
  }
  const previous = new Date(version);
  const result = await prisma.userHomePreference.updateMany({ where: { userId, updatedAt: previous },
    data: { selectedChildId, updatedAt: new Date(Math.max(Date.now(), previous.getTime() + 1)) } });
  return result.count === 1;
}
