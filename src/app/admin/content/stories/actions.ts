"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HomeStoryItemStatus, HomeStoryPlacementType, HomeStorySourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import { zonedDayRange } from "@/lib/stories/ranges";
import { invalidateHomeStories, validateOfferSessionForManualPlacement } from "@/server/stories/homeStoryItems";

const addSchema = z.object({
  cityId: z.string().min(1), date: z.iso.date(), sessionId: z.string().min(1),
  pinned: z.boolean().default(false), displayFrom: z.string().optional(), displayUntil: z.string().optional(),
});
const editSchema = z.object({
  id: z.string().min(1), action: z.enum(["pin", "unpin", "exclude", "auto", "up", "down"]),
});
const canonicalEditSchema = z.object({
  stableId: z.string().min(1), cityId: z.string().min(1), date: z.iso.date(),
  action: z.enum(["pin", "unpin", "exclude", "auto", "up", "down"]),
});

async function requireContentAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) throw new Error("Недостаточно прав");
  return user;
}

export async function addOfferOccurrenceAction(formData: FormData) {
  const user = await requireContentAdmin();
  const parsed = addSchema.parse({
    cityId: formData.get("cityId"), date: formData.get("date"), sessionId: formData.get("sessionId"),
    pinned: formData.get("pinned") === "on", displayFrom: String(formData.get("displayFrom") || "") || undefined,
    displayUntil: String(formData.get("displayUntil") || "") || undefined,
  });
  const session = await validateOfferSessionForManualPlacement(parsed.sessionId, parsed.cityId);
  if (!session) throw new Error("Опубликованный occurrence Offer не найден для выбранного города");
  const timeZone = getCityTimeZone(parsed.cityId);
  const storyDate = zonedDayRange(parsed.date, 1, timeZone).start;
  const sourceCityId = session.offer.cityId ?? session.offer.place?.cityId;
  if (sourceCityId !== parsed.cityId) throw new Error("Occurrence относится к другому городу");
  const citySlug = session.offer.place?.city?.slug;
  if (!citySlug) throw new Error("У города Offer отсутствует публичный slug");
  const href = `/${citySlug}/offers/${session.offer.slug ?? session.offerId}`;
  const unique = { cityId_sourceType_sourceId_occurrenceKey_storyDate: {
    cityId: parsed.cityId, sourceType: HomeStorySourceType.OFFER, sourceId: session.offerId,
    occurrenceKey: session.id, storyDate,
  } };
  await prisma.$transaction(async (tx) => {
    const item = await tx.homeStoryItem.upsert({
      where: unique,
      create: {
        cityId: parsed.cityId, storyDate, sourceType: HomeStorySourceType.OFFER,
        sourceId: session.offerId, occurrenceKey: session.id,
        placementType: HomeStoryPlacementType.FORCE_INCLUDE, status: HomeStoryItemStatus.ACTIVE,
        startsAt: session.startAt, endsAt: session.endAt, pinned: parsed.pinned,
        displayFrom: parsed.displayFrom ? new Date(parsed.displayFrom) : null,
        displayUntil: parsed.displayUntil ? new Date(parsed.displayUntil) : null,
        titleSnapshot: session.offer.title, subtitleSnapshot: session.offer.description,
        hrefSnapshot: href, coverUrlSnapshot: session.offer.coverImage, createdById: user.id, updatedById: user.id,
      },
      update: {
        placementType: HomeStoryPlacementType.FORCE_INCLUDE, status: HomeStoryItemStatus.ACTIVE,
        inactiveReason: null, startsAt: session.startAt, endsAt: session.endAt, pinned: parsed.pinned,
        displayFrom: parsed.displayFrom ? new Date(parsed.displayFrom) : null,
        displayUntil: parsed.displayUntil ? new Date(parsed.displayUntil) : null,
        titleSnapshot: session.offer.title, subtitleSnapshot: session.offer.description,
        hrefSnapshot: href, coverUrlSnapshot: session.offer.coverImage, updatedById: user.id,
      },
    });
    await tx.adminAuditLog.create({ data: {
      actorId: user.id, actorRole: user.role, action: "HOME_STORY_FORCE_INCLUDE",
      entityType: "HOME_STORY_ITEM", entityId: item.id,
      after: { sourceType: "OFFER", sourceId: session.offerId, occurrenceKey: session.id, cityId: parsed.cityId, storyDate: storyDate.toISOString() },
    } });
  });
  invalidateHomeStories(parsed.cityId, storyDate);
  revalidatePath("/admin/ranking/stories-intents");
  redirect(`/admin/ranking/stories-intents?cityId=${parsed.cityId}&date=${parsed.date}`);
}

export async function editStoryItemAction(formData: FormData) {
  const user = await requireContentAdmin();
  const parsed = editSchema.parse({ id: formData.get("id"), action: formData.get("action") });
  const before = await prisma.homeStoryItem.findUniqueOrThrow({ where: { id: parsed.id } });
  const delta = parsed.action === "up" ? -1 : parsed.action === "down" ? 1 : 0;
  const data = parsed.action === "pin" ? { pinned: true }
    : parsed.action === "unpin" ? { pinned: false }
    : parsed.action === "exclude" ? { placementType: HomeStoryPlacementType.EXCLUDE }
    : parsed.action === "auto" && before.sourceType === HomeStorySourceType.EVENT
      ? { placementType: HomeStoryPlacementType.AUTO, status: HomeStoryItemStatus.ACTIVE, inactiveReason: null }
      : delta ? { manualOrder: (before.manualOrder ?? 1000) + delta } : {};
  const after = await prisma.$transaction(async (tx) => {
    const item = await tx.homeStoryItem.update({ where: { id: before.id }, data: { ...data, updatedById: user.id } });
    await tx.adminAuditLog.create({ data: {
      actorId: user.id, actorRole: user.role, action: `HOME_STORY_${parsed.action.toUpperCase()}`,
      entityType: "HOME_STORY_ITEM", entityId: item.id,
      before: { placementType: before.placementType, pinned: before.pinned, manualOrder: before.manualOrder },
      after: { placementType: item.placementType, pinned: item.pinned, manualOrder: item.manualOrder },
      metadata: { sourceType: item.sourceType, sourceId: item.sourceId, occurrenceKey: item.occurrenceKey, cityId: item.cityId, storyDate: item.storyDate.toISOString() },
    } });
    return item;
  });
  invalidateHomeStories(after.cityId, after.storyDate);
  revalidatePath("/admin/ranking/stories-intents");
}

/** Creates/updates placement metadata for a canonical rail item. */
export async function editCanonicalStoryAction(formData: FormData) {
  const user = await requireContentAdmin();
  const parsed = canonicalEditSchema.parse({ stableId: formData.get("stableId"), cityId: formData.get("cityId"), date: formData.get("date"), action: formData.get("action") });
  const [kind, rawId] = parsed.stableId.split(":", 2);
  if (!kind || !rawId) throw new Error("Некорректный stable Story id");
  const timeZone = getCityTimeZone(parsed.cityId);
  const city = await prisma.city.findUnique({ where: { id: parsed.cityId }, select: { slug: true } });
  if (!city?.slug) throw new Error("У города нет public slug");
  const storyDate = zonedDayRange(parsed.date, 1, timeZone).start;
  const isSession = kind.endsWith("-session");
  const isOffer = kind.startsWith("offer");
  const session = isSession
    ? isOffer
      ? await prisma.offerSession.findUnique({ where: { id: rawId }, select: { id: true, offerId: true, startAt: true, endAt: true, offer: { select: { title: true, description: true, coverImage: true, slug: true } } } })
      : await prisma.activitySession.findUnique({ where: { id: rawId }, select: { id: true, activityId: true, startsAt: true, activity: { select: { title: true, shortDesc: true, coverImageUrl: true, slug: true } } } })
    : null;
  const sourceId = session ? ("offerId" in session ? session.offerId : session.activityId) : rawId;
  const entity = !session
    ? isOffer
      ? await prisma.offer.findUnique({ where: { id: sourceId }, select: { title: true, description: true, coverImage: true, slug: true, dateFrom: true, dateTo: true } })
      : await prisma.activity.findUnique({ where: { id: sourceId }, select: { title: true, shortDesc: true, coverImageUrl: true, slug: true, nextOccurrenceAt: true } })
    : null;
  const content = session ? ("offer" in session ? session.offer : session.activity) : entity;
  if (!content) throw new Error("Canonical Story source больше не существует");
  const occurrenceKey = isSession ? rawId : sourceId;
  const unique = { cityId_sourceType_sourceId_occurrenceKey_storyDate: { cityId: parsed.cityId, sourceType: isOffer ? HomeStorySourceType.OFFER : HomeStorySourceType.EVENT, sourceId, occurrenceKey, storyDate } };
  const existing = await prisma.homeStoryItem.findUnique({ where: unique });
  const delta = parsed.action === "up" ? -1 : parsed.action === "down" ? 1 : 0;
  const placement = parsed.action === "exclude" ? HomeStoryPlacementType.EXCLUDE : HomeStoryPlacementType.AUTO;
  const startsAt = session ? ("startAt" in session ? session.startAt : session.startsAt) : entity && ("dateFrom" in entity ? entity.dateFrom : entity.nextOccurrenceAt);
  await prisma.homeStoryItem.upsert({
    where: unique,
    create: {
      ...unique.cityId_sourceType_sourceId_occurrenceKey_storyDate,
      placementType: placement, status: HomeStoryItemStatus.ACTIVE,
      pinned: parsed.action === "pin", manualOrder: delta ? 1000 + delta : null,
      startsAt, titleSnapshot: content.title,
      subtitleSnapshot: "description" in content ? content.description : content.shortDesc,
      hrefSnapshot: `/${city.slug}/${isOffer ? "offers" : "events"}/${content.slug ?? sourceId}`,
      coverUrlSnapshot: "coverImage" in content ? content.coverImage : content.coverImageUrl,
      createdById: user.id, updatedById: user.id,
    },
    update: {
      placementType: parsed.action === "auto" ? HomeStoryPlacementType.AUTO : parsed.action === "exclude" ? HomeStoryPlacementType.EXCLUDE : existing?.placementType,
      pinned: parsed.action === "pin" ? true : parsed.action === "unpin" ? false : existing?.pinned,
      manualOrder: delta ? (existing?.manualOrder ?? 1000) + delta : existing?.manualOrder,
      updatedById: user.id,
    },
  });
  invalidateHomeStories(parsed.cityId, storyDate);
  revalidatePath("/admin/ranking/stories-intents");
}
