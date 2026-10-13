import { Prisma } from "@prisma/client";
import type { OfferRevision, Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  applyCampSessionTexts,
  isRevisionPseudoColumn,
  replaceRevisionColumns,
  pruneRevisionPayload,
  type OfferRevisionPayload,
} from "@/lib/offers/offerRevisionPayload";
import { projectCampSessions } from "@/server/offers/campSessionProjection";
import { syncOfferCategories } from "@/server/offers/offerCategories";
import { syncOfferPersistenceLayer } from "@/server/offers/offerPersistence";
import { syncOfferMediaUsage } from "@/server/services/media/media-usage.service";
import { syncOfferHomeStoryPlacements } from "@/server/stories/homeStoryItems";
import {
  notifyOfferRevisionApproved,
  notifyOfferRevisionRejected,
} from "@/server/services/notification.service";

type Tx = Prisma.TransactionClient;

export class OfferRevisionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_PENDING" | "UNSUPPORTED_COLUMN",
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Json-колонки Offer: для них «пустое» значение — `Prisma.DbNull`, а не `null`. */
const OFFER_JSON_COLUMNS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .find((model) => model.name === "Offer")
    ?.fields.filter((field) => field.type === "Json")
    .map((field) => field.name) ?? [],
);

/**
 * Записать контентные правки опубликованного оффера в ожидающую ревизию (одна PENDING на оффер).
 * Каждый запрос пересчитывает ревизию по присутствующим в нём колонкам; колонки, совпавшие с живыми,
 * убираются; если ничего не осталось — ожидающая ревизия снимается.
 */
export async function savePendingOfferRevision(
  tx: Tx,
  params: {
    offerId: string;
    authorId: string | null;
    /** Предлагаемые значения контентных колонок из этого запроса. */
    proposal: OfferRevisionPayload;
    /** Все колонки, присутствовавшие в запросе: они пересчитываются заново (см. `replaceRevisionColumns`). */
    presentColumns: readonly string[];
    live: Record<string, unknown> & { updatedAt?: Date };
  },
): Promise<{ revisionId: string | null; created: boolean; changedFields: string[] }> {
  const existing = await tx.offerRevision.findFirst({
    where: { offerId: params.offerId, status: "PENDING" },
  });

  const merged = replaceRevisionColumns(
    (existing?.payload as OfferRevisionPayload | null) ?? null,
    params.presentColumns,
    params.proposal,
  );
  const payload = pruneRevisionPayload(merged, params.live);
  const changedFields = Object.keys(payload);

  if (changedFields.length === 0) {
    if (existing) await tx.offerRevision.delete({ where: { id: existing.id } });
    return { revisionId: null, created: false, changedFields: [] };
  }

  if (existing) {
    await tx.offerRevision.update({
      where: { id: existing.id },
      data: { payload: payload as Prisma.InputJsonValue, changedFields, authorId: params.authorId },
    });
    return { revisionId: existing.id, created: false, changedFields };
  }

  const created = await tx.offerRevision.create({
    data: {
      offerId: params.offerId,
      authorId: params.authorId,
      payload: payload as Prisma.InputJsonValue,
      changedFields,
      baseOfferUpdatedAt: params.live.updatedAt ?? null,
    },
  });
  return { revisionId: created.id, created: true, changedFields };
}

export async function loadPendingOfferRevision(
  db: Pick<Tx, "offerRevision">,
  offerId: string,
): Promise<OfferRevision | null> {
  return db.offerRevision.findFirst({ where: { offerId, status: "PENDING" } });
}

async function lockPendingRevision(tx: Tx, revisionId: string) {
  const revision = await tx.offerRevision.findUnique({ where: { id: revisionId } });
  if (!revision) throw new OfferRevisionError("NOT_FOUND");
  // Блокируем оффер: решение и запись в живую строку — один снимок.
  await tx.$queryRaw`SELECT "id" FROM "Offer" WHERE "id" = ${revision.offerId} FOR UPDATE`;
  const fresh = await tx.offerRevision.findUnique({ where: { id: revisionId } });
  if (!fresh) throw new OfferRevisionError("NOT_FOUND");
  if (fresh.status !== "PENDING") throw new OfferRevisionError("NOT_PENDING");
  return fresh;
}

/** Применить ревизию к живому офферу и закрыть её как одобренную. */
export async function approveOfferRevision(revisionId: string, reviewerId: string, reviewerRole: Role) {
  const result = await prisma.$transaction(async (tx) => {
    const revision = await lockPendingRevision(tx, revisionId);
    const payload = revision.payload as OfferRevisionPayload;
    const live = await tx.offer.findUniqueOrThrow({ where: { id: revision.offerId } });

    const data: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(payload)) {
      if (isRevisionPseudoColumn(column)) continue;
      data[column] =
        value === null && OFFER_JSON_COLUMNS.has(column) ? Prisma.DbNull : value;
    }

    // Смены: при смене типа на/с лагеря ревизия несёт смены целиком (`campSessions`) — берём их как есть;
    // иначе (`campSessionTexts`) накладываем только тексты на живые смены (даты/цена/места остаются живыми).
    let nextCampSessions: unknown = live.campSessions;
    if ("campSessions" in payload) {
      nextCampSessions = payload.campSessions;
    } else if ("campSessionTexts" in payload) {
      nextCampSessions = applyCampSessionTexts(live.campSessions, payload.campSessionTexts);
      data.campSessions = nextCampSessions;
    }
    const approvedProductType =
      ("productType" in payload ? (payload.productType as typeof live.productType) : live.productType) ?? null;

    if (Object.keys(data).length > 0) {
      await tx.offer.update({ where: { id: live.id }, data: data as Prisma.OfferUpdateInput });
    }

    if ("categoryIds" in payload) {
      await syncOfferCategories({
        db: tx,
        offerId: live.id,
        productType: approvedProductType,
        categoryIds: payload.categoryIds,
      });
    }

    if ("requestedPlacements" in payload) {
      await syncOfferPersistenceLayer({
        db: tx,
        offerId: live.id,
        actorUserId: reviewerId,
        productType: approvedProductType ?? "ONE_TIME_ACTIVITY",
        requestedPlacementsStrategy: "preserve_if_missing",
        requestedPlacements: Array.isArray(payload.requestedPlacements)
          ? (payload.requestedPlacements as string[])
          : [],
        requestedPlacementsProvided: true,
      });
    }

    for (const column of Object.keys(payload)) {
      if (isRevisionPseudoColumn(column) && !SUPPORTED_PSEUDO_COLUMNS.has(column)) {
        throw new OfferRevisionError("UNSUPPORTED_COLUMN", column);
      }
    }
    // Проекция смен строится из одобренного типа: на лагерь — из принятых смен, с лагеря — очищается.
    const approvedIsCamp =
      "campProgramType" in payload ? Boolean(payload.campProgramType) : Boolean(live.campProgramType);
    if (approvedIsCamp || live.campProgramType) {
      await projectCampSessions(tx, live.id, approvedIsCamp ? nextCampSessions : []);
    }

    const before = Object.fromEntries(
      Object.keys(payload).map((column) => [column, jsonSafe((live as Record<string, unknown>)[column])]),
    );
    await tx.offerRevision.update({
      where: { id: revision.id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: reviewerId },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: reviewerId,
        actorRole: reviewerRole,
        action: "offer.revision_approved",
        entityType: "Offer",
        entityId: live.id,
        before: before as Prisma.InputJsonValue,
        after: payload as Prisma.InputJsonValue,
        metadata: { revisionId: revision.id, columns: Object.keys(payload) },
      },
    });

    return { revision, offerId: live.id, title: (data.title as string | undefined) ?? live.title, authorId: revision.authorId, payload };
  });

  if ("coverImage" in result.payload || "galleryImages" in result.payload) {
    try {
      await syncOfferMediaUsage(result.offerId);
    } catch (error) {
      console.error(`[offer-revision] media usage sync failed for ${result.offerId}:`, error);
    }
  }
  try {
    await syncOfferHomeStoryPlacements(result.offerId);
  } catch (error) {
    console.error(`[offer-revision] story placements sync failed for ${result.offerId}:`, error);
  }
  // Решение уже зафиксировано: сбой уведомления не должен превращать успех в ошибку (повтор дал бы NOT_PENDING).
  if (result.authorId) {
    try {
      await notifyOfferRevisionApproved(result.offerId, result.title, result.authorId);
    } catch (error) {
      console.error(`[offer-revision] approval notification failed for ${result.offerId}:`, error);
    }
  }
  return { offerId: result.offerId };
}

/** Отклонить ревизию с комментарием модератора. Живой оффер не меняется. */
export async function rejectOfferRevision(
  revisionId: string,
  reviewerId: string,
  reviewerRole: Role,
  comment: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const revision = await lockPendingRevision(tx, revisionId);
    const offer = await tx.offer.findUniqueOrThrow({
      where: { id: revision.offerId },
      select: { id: true, title: true },
    });
    await tx.offerRevision.update({
      where: { id: revision.id },
      data: {
        status: "REJECTED",
        moderatorComment: comment,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: reviewerId,
        actorRole: reviewerRole,
        action: "offer.revision_rejected",
        entityType: "Offer",
        entityId: offer.id,
        reason: comment,
        metadata: { revisionId: revision.id, columns: revision.changedFields },
      },
    });
    return { offer, authorId: revision.authorId };
  });

  if (result.authorId) {
    try {
      await notifyOfferRevisionRejected(result.offer.id, result.offer.title, result.authorId, comment);
    } catch (error) {
      console.error(`[offer-revision] rejection notification failed for ${result.offer.id}:`, error);
    }
  }
  return { offerId: result.offer.id };
}

function jsonSafe(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value ?? null));
}

/** Псевдоколонки, которые умеет применять эта реализация. Новая псевдоколонка = новый обработчик в `approveOfferRevision`. */
const SUPPORTED_PSEUDO_COLUMNS: ReadonlySet<string> = new Set([
  "requestedPlacements",
  "campSessionTexts",
  "categoryIds",
]);
