/**
 * ImportPublishService — Phase 3 (cleanup) + EVENT apply
 *
 * PLACE: publish/apply из ImportedRecord с reviewStatus=APPROVED.
 * EVENT: publish/apply в Activity из ImportedRecord с reviewStatus=APPROVED.
 *
 * Оба пути:
 * - опираются исключительно на reviewDecision
 * - applyResult хранится отдельно от reviewDecision
 * - non-destructive update policy
 * - no bulk/auto publish
 */

import prisma from "@/lib/prisma";
import type {
  NormalizedPlaceImport,
  NormalizedEventImport,
  ReviewDecisionPayload,
  PlaceApplyResult,
  PlaceApplyValidationError,
} from "../types";
import { mapNormalizedToPlace, filterNonDestructiveUpdates } from "../publish/place-field-mapper";
import { mapNormalizedToActivity, filterActivityNonDestructiveUpdates } from "../publish/event-field-mapper";
import { loadFieldOverrides, loadActivityFieldOverrides, applyOverrideFilter, isFieldAllowed } from "../publish/field-override-checker";
import { lookupCityId } from "../publish/city-lookup";
import { lookupVenuePlace } from "../publish/venue-place-lookup";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { optimizeImportedImage } from "@/server/media/imported-image-optimizer";
import {
  clearRecoveryFromReviewDecision,
  ensureActiveImportDecisionTarget,
  reconcileImportedRecordLinkById,
} from "./import-link-reconciliation.service";
import { createTimer } from "@/server/utils/timing";

// ── Apply result payload (stored in ImportedRecord.applyResult) ───────────────

interface ApplyResultPayload {
  appliedAt: string;
  appliedByUserId: string;
  decision: string;
  placeId?: string;
  activityId?: string;
  activitySlug?: string;
  appliedFields: string[];
  skippedFields: string[];
  emptyFields: string[];
  warnings?: string[];
  note?: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidatedApplyContext {
  record: {
    id: string;
    reviewStatus: string;
    reviewDecision: ReviewDecisionPayload;
    normalizedData: NormalizedPlaceImport | NormalizedEventImport;
    entityTypeHint: string | null;
    publishedPlaceId: string | null;
    publishedActivityId: string | null;
  };
  decision: ReviewDecisionPayload;
}

async function validateAndLoad(
  importedRecordId: string,
  expectedEntityType: "PLACE" | "EVENT",
): Promise<ValidatedApplyContext | PlaceApplyValidationError> {
  const record = await reconcileImportedRecordLinkById(importedRecordId, prisma);

  if (!record) return { success: false, recordId: importedRecordId, reason: "ImportedRecord not found" };
  if (record.entityTypeHint !== expectedEntityType) return { success: false, recordId: importedRecordId, reason: `entityTypeHint is ${record.entityTypeHint}, expected ${expectedEntityType}` };
  if (record.reviewStatus !== "APPROVED") return { success: false, recordId: importedRecordId, reason: `reviewStatus is ${record.reviewStatus}, expected APPROVED` };
  if (!record.reviewDecision) return { success: false, recordId: importedRecordId, reason: "reviewDecision is missing" };
  if (!record.normalizedData) return { success: false, recordId: importedRecordId, reason: "normalizedData is missing" };

  const decision = record.reviewDecision as unknown as ReviewDecisionPayload;
  const approvedDecisions = ["APPROVED_CREATE", "APPROVED_UPDATE", "APPROVED_MERGE"];
  if (!approvedDecisions.includes(decision.decision)) {
    return { success: false, recordId: importedRecordId, reason: `decision is ${decision.decision}, not an approved action` };
  }
  if (
    (decision.decision === "APPROVED_UPDATE" || decision.decision === "APPROVED_MERGE") &&
    !decision.targetEntityId
  ) {
    return { success: false, recordId: importedRecordId, reason: `decision ${decision.decision} requires targetEntityId` };
  }
  if (
    (decision.decision === "APPROVED_UPDATE" || decision.decision === "APPROVED_MERGE") &&
    decision.targetEntityId &&
    decision.targetEntityType
  ) {
    await ensureActiveImportDecisionTarget({
      entityType: decision.targetEntityType,
      entityId: decision.targetEntityId,
      db: prisma,
    });
  }

  return {
    record: {
      id: record.id,
      reviewStatus: record.reviewStatus,
      reviewDecision: decision,
      normalizedData: record.normalizedData as unknown as NormalizedPlaceImport | NormalizedEventImport,
      entityTypeHint: record.entityTypeHint,
      publishedPlaceId: record.publishedPlaceId,
      publishedActivityId: record.publishedActivityId,
    },
    decision,
  };
}

// ── Main entry points ─────────────────────────────────────────────────────────

/**
 * Применить approved PLACE ImportedRecord.
 * Вызывается явно из admin action — не автоматически.
 */
export async function publishApprovedRecord(
  importedRecordId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const ctx = await validateAndLoad(importedRecordId, "PLACE");
  if (!("record" in ctx)) return ctx;

  const { record, decision } = ctx;

  if (record.publishedPlaceId) {
    return { success: false, recordId: importedRecordId, reason: `Already published as Place ${record.publishedPlaceId}` };
  }

  const nd = record.normalizedData as NormalizedPlaceImport;
  switch (decision.decision) {
    case "APPROVED_CREATE": return createPlaceFromImport({ ...record, normalizedData: nd }, actorUserId);
    case "APPROVED_UPDATE": return updateExistingPlaceFromImport({ ...record, normalizedData: nd }, decision.targetEntityId!, actorUserId);
    case "APPROVED_MERGE":  return mergeImportedRecordIntoPlace({ ...record, normalizedData: nd }, decision.targetEntityId!, actorUserId);
    default: return { success: false, recordId: importedRecordId, reason: "Unhandled decision type" };
  }
}

/**
 * Применить approved EVENT ImportedRecord в Activity.
 * Вызывается явно из admin action — не автоматически.
 * Опирается на reviewDecision, не на suggestedAction.
 */
export async function publishApprovedEventRecord(
  importedRecordId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const t = createTimer("import-publish:event");
  const ctx = await validateAndLoad(importedRecordId, "EVENT");
  t.mark("validate-and-load");
  if (!("record" in ctx)) return ctx;

  const { record, decision } = ctx;

  if (record.publishedActivityId) {
    return { success: false, recordId: importedRecordId, reason: `Already published as Activity ${record.publishedActivityId}` };
  }

  const nd = record.normalizedData as NormalizedEventImport;
  let result: PlaceApplyResult | PlaceApplyValidationError;
  switch (decision.decision) {
    case "APPROVED_CREATE": result = await createActivityFromImport({ ...record, normalizedData: nd }, actorUserId); break;
    case "APPROVED_UPDATE": result = await updateExistingActivityFromImport({ ...record, normalizedData: nd }, decision.targetEntityId!, actorUserId); break;
    case "APPROVED_MERGE":  result = await mergeImportedRecordIntoActivity({ ...record, normalizedData: nd }, decision.targetEntityId!, actorUserId); break;
    default: result = { success: false, recordId: importedRecordId, reason: "Unhandled decision type" };
  }
  t.end();
  return result;
}

// ── Persist apply result (separate from reviewDecision) ───────────────────────

async function persistPlaceApplyResult(
  recordId: string,
  placeId: string,
  payload: Omit<ApplyResultPayload, "placeId" | "activityId">,
): Promise<void> {
  const existing = await prisma.importedRecord.findUnique({
    where: { id: recordId },
    select: { reviewDecision: true },
  });
  await prisma.importedRecord.update({
    where: { id: recordId },
    data: {
      publishedPlaceId: placeId,
      applyResult: { ...payload, placeId } as object,
      ...(clearRecoveryFromReviewDecision(existing?.reviewDecision) !== undefined
        ? { reviewDecision: clearRecoveryFromReviewDecision(existing?.reviewDecision) }
        : {}),
    },
  });
}

async function persistActivityApplyResult(
  recordId: string,
  activityId: string,
  payload: Omit<ApplyResultPayload, "placeId" | "activityId">,
): Promise<void> {
  // Один запрос вместо двух: upsert reviewDecision clearing inline
  await prisma.importedRecord.update({
    where: { id: recordId },
    data: {
      publishedActivityId: activityId,
      applyResult: { ...payload, activityId } as object,
    },
  });
}

// ── CREATE ────────────────────────────────────────────────────────────────────

// ── PLACE CREATE ──────────────────────────────────────────────────────────────

async function createPlaceFromImport(
  record: { id: string; normalizedData: NormalizedPlaceImport },
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const nd = record.normalizedData;
  const mappingResult = mapNormalizedToPlace(nd);
  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  const { fields, warnings } = mappingResult;
  const cityId = fields.cityName ? await lookupCityId(fields.cityName) : null;
  if (fields.cityName && !cityId) warnings.push(`City "${fields.cityName}" not found — cityId will be null`);

  const appliedFields: string[] = [];
  const emptyFields: string[] = [];

  const createData: Record<string, unknown> = {
    title: fields.title, shortDesc: fields.shortDesc, category: fields.category,
    status: "PENDING", createdByUserId: actorUserId, locationSource: "MANUAL",
  };
  appliedFields.push("title", "shortDesc", "category", "status", "createdByUserId");

  if (fields.description)  { createData.description  = fields.description;  appliedFields.push("description"); }  else emptyFields.push("description");
  if (fields.formattedAddr){ createData.formattedAddr = fields.formattedAddr; appliedFields.push("formattedAddr"); } else emptyFields.push("formattedAddr");
  if (cityId)              { createData.cityId        = cityId;               appliedFields.push("cityId"); }       else emptyFields.push("cityId");
  if (fields.lat != null)  { createData.lat           = fields.lat;           appliedFields.push("lat"); }          else emptyFields.push("lat");
  if (fields.lng != null)  { createData.lng           = fields.lng;           appliedFields.push("lng"); }          else emptyFields.push("lng");
  if (fields.phone)        { createData.phone         = fields.phone;         appliedFields.push("phone"); }        else emptyFields.push("phone");
  if (fields.website)      { createData.website       = fields.website;       appliedFields.push("website"); }      else emptyFields.push("website");
  if (nd.imageUrls.length > 0) emptyFields.push("logoImageId (pending media ingestion)");

  const place = await prisma.place.create({ data: createData as never });

  await persistPlaceApplyResult(record.id, place.id, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_CREATE", appliedFields, skippedFields: [], emptyFields,
    warnings: warnings.length > 0 ? warnings : undefined,
  });

  return { success: true, recordId: record.id, decision: "APPROVED_CREATE", placeId: place.id, appliedFields, skippedFields: [], emptyFields };
}

// ── PLACE UPDATE ──────────────────────────────────────────────────────────────

async function updateExistingPlaceFromImport(
  record: { id: string; normalizedData: NormalizedPlaceImport },
  targetPlaceId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const existingPlace = await prisma.place.findUnique({ where: { id: targetPlaceId } });
  if (!existingPlace) return { success: false, recordId: record.id, reason: `Target Place ${targetPlaceId} not found` };

  const nd = record.normalizedData;
  const mappingResult = mapNormalizedToPlace(nd);
  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  const { fields } = mappingResult;
  const cityId = fields.cityName ? await lookupCityId(fields.cityName) : null;

  const overrides = await loadFieldOverrides(targetPlaceId);
  const titleOverrideAllowed = isFieldAllowed("title", overrides) && overrides["title"] === "PREFER_IMPORT";

  const { updates: candidateUpdates, titleSkipped } = filterNonDestructiveUpdates(
    { ...fields, cityId: cityId ?? undefined } as never,
    existingPlace as unknown as Record<string, unknown>,
    titleOverrideAllowed,
  );

  const { allowed, skipped } = applyOverrideFilter(candidateUpdates as Record<string, unknown>, overrides);
  const allSkipped = [...skipped, ...(titleSkipped ? ["title (existing non-empty, no PREFER_IMPORT override)"] : [])];
  const emptyFields = Object.keys(fields).filter((k) => !(k in candidateUpdates) && k !== "cityName");

  if (Object.keys(allowed).length > 0) {
    await prisma.place.update({ where: { id: targetPlaceId }, data: allowed as never });
  }

  await persistPlaceApplyResult(record.id, targetPlaceId, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_UPDATE", appliedFields: Object.keys(allowed), skippedFields: allSkipped, emptyFields,
    note: Object.keys(allowed).length === 0 ? "No fields updated — all blocked or empty" : undefined,
  });

  return { success: true, recordId: record.id, decision: "APPROVED_UPDATE", placeId: targetPlaceId, appliedFields: Object.keys(allowed), skippedFields: allSkipped, emptyFields };
}

// ── PLACE MERGE ───────────────────────────────────────────────────────────────

async function mergeImportedRecordIntoPlace(
  record: { id: string; normalizedData: NormalizedPlaceImport },
  targetPlaceId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const existingPlace = await prisma.place.findUnique({ where: { id: targetPlaceId } });
  if (!existingPlace) return { success: false, recordId: record.id, reason: `Target Place ${targetPlaceId} not found` };

  const nd = record.normalizedData;
  const mappingResult = mapNormalizedToPlace(nd);
  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  const { fields } = mappingResult;
  const cityId = fields.cityName ? await lookupCityId(fields.cityName) : null;

  const mergeFields: Record<string, unknown> = {};
  const skippedNonEmpty: string[] = [];
  const emptyFields: string[] = [];

  for (const [fieldName, newVal] of [
    ["description", fields.description], ["formattedAddr", fields.formattedAddr],
    ["phone", fields.phone], ["website", fields.website],
    ["lat", fields.lat], ["lng", fields.lng], ["cityId", cityId],
  ] as [string, unknown][]) {
    if (newVal === undefined || newVal === null || newVal === "") { emptyFields.push(fieldName); continue; }
    const existingVal = (existingPlace as Record<string, unknown>)[fieldName];
    if (existingVal !== null && existingVal !== undefined && String(existingVal).trim() !== "") {
      skippedNonEmpty.push(fieldName);
    } else {
      mergeFields[fieldName] = newVal;
    }
  }

  const overrides = await loadFieldOverrides(targetPlaceId);
  const { allowed, skipped: skippedByOverride } = applyOverrideFilter(mergeFields, overrides);
  const allSkipped = [...skippedNonEmpty, ...skippedByOverride];

  if (Object.keys(allowed).length > 0) {
    await prisma.place.update({ where: { id: targetPlaceId }, data: allowed as never });
  }

  await persistPlaceApplyResult(record.id, targetPlaceId, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_MERGE", appliedFields: Object.keys(allowed), skippedFields: allSkipped, emptyFields,
    note: Object.keys(allowed).length === 0 ? "No fields merged — all blocked or non-empty in target" : undefined,
  });

  return { success: true, recordId: record.id, decision: "APPROVED_MERGE", placeId: targetPlaceId, appliedFields: Object.keys(allowed), skippedFields: allSkipped, emptyFields };
}

// ── EVENT CREATE ──────────────────────────────────────────────────────────────

async function createActivityFromImport(
  record: { id: string; normalizedData: NormalizedEventImport },
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const t = createTimer("import-publish:create-event");
  const nd = record.normalizedData;

  // ── Параллельно: cityId + venue lookup + field mapping ────────────────────
  const [cityId, mappingResult] = await Promise.all([
    nd.cityName ? lookupCityId(nd.cityName) : Promise.resolve(null),
    mapNormalizedToActivity(nd, null), // cityId подставим ниже
  ]);
  t.mark("lookup-city+mapping");

  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  // Подставляем cityId в fields
  if (cityId) mappingResult.fields.cityId = cityId;

  // Venue lookup — параллельно не можем (нужен cityId), но ограничен take:10
  const venuePlace = await lookupVenuePlace(nd.venueName, nd.addressText, cityId);
  t.mark("venue-lookup");

  const { fields, warnings } = mappingResult;
  const appliedFields: string[] = [];
  const emptyFields: string[] = [];

  const createData: Record<string, unknown> = {
    title: fields.title,
    shortDesc: fields.shortDesc,
    type: fields.type,
    format: fields.format,
    scheduleMode: fields.scheduleMode,
    ownerUserId: actorUserId,
    status: "PENDING",
  };
  appliedFields.push("title", "shortDesc", "type", "format", "scheduleMode", "ownerUserId", "status");

  if (fields.description)      { createData.description      = fields.description;      appliedFields.push("description"); }      else emptyFields.push("description");
  if (fields.cityId)           { createData.cityId           = fields.cityId;           appliedFields.push("cityId"); }           else emptyFields.push("cityId");
  if (fields.priceText)        { createData.priceText        = fields.priceText;        appliedFields.push("priceText"); }
  if (fields.priceFrom != null){ createData.priceFrom        = fields.priceFrom;        appliedFields.push("priceFrom"); }
  if (fields.priceTo != null)  { createData.priceTo          = fields.priceTo;          appliedFields.push("priceTo"); }
  if (fields.ageTags?.length)  { createData.ageTags          = fields.ageTags;          appliedFields.push("ageTags"); }          else emptyFields.push("ageTags");
  if (fields.ageMinMonths != null){ createData.ageMinMonths  = fields.ageMinMonths;     appliedFields.push("ageMinMonths"); }     else emptyFields.push("ageMinMonths");
  if (fields.ageMaxMonths != null){ createData.ageMaxMonths  = fields.ageMaxMonths;     appliedFields.push("ageMaxMonths"); }     else emptyFields.push("ageMaxMonths");
  if (fields.scheduleJson)     { createData.scheduleJson     = fields.scheduleJson;     appliedFields.push("scheduleJson"); }     else emptyFields.push("scheduleJson");
  if (fields.nextOccurrenceAt) { createData.nextOccurrenceAt = fields.nextOccurrenceAt; appliedFields.push("nextOccurrenceAt"); } else emptyFields.push("nextOccurrenceAt");

  if (venuePlace) {
    createData.placeId = venuePlace.placeId;
    appliedFields.push("placeId");
    warnings.push(`venue linked to Place "${venuePlace.placeTitle}" (score=${venuePlace.score.toFixed(2)}, ${venuePlace.reason})`);
  } else {
    emptyFields.push("placeId");
  }

  if (fields.coverImageUrl) {
    createData.coverImageUrl = fields.coverImageUrl;
    appliedFields.push("coverImageUrl");
  } else if (nd.imageUrls.length > 0) {
    emptyFields.push("coverImageUrl (no HTTPS URL in import)");
  }

  // ── CREATE Activity — включаем slug в select чтобы не делать второй запрос ─
  const activity = await prisma.activity.create({
    data: createData as never,
    select: { id: true, slug: true },
  });
  t.mark("create-activity");

  // ── Параллельно: slug assignment + venue create + persist apply result ─────
  const venueCreatePromise = (nd.venueName || nd.addressText)
    ? prisma.eventVenue.create({
        data: {
          activity: { connect: { id: activity.id } },
          kind: venuePlace ? "PLACE" : "MANUAL",
          title: nd.venueName ?? null,
          addressLine: nd.addressText ?? null,
          cityId: cityId ?? null,
          ...(venuePlace ? { place: { connect: { id: venuePlace.placeId } } } : {}),
        },
      })
    : Promise.resolve(null);

  // slug assignment — не блокирует ответ, запускаем параллельно
  const slugPromise = assignActivitySlugIfMissing(activity.id, fields.title).catch(() => {
    // slug не критичен — не блокируем
  });

  // Ждём только venue (нужен для appliedFields) и slug (нужен для ответа)
  await Promise.all([venueCreatePromise, slugPromise]);
  t.mark("venue-create+slug");

  if (nd.venueName || nd.addressText) appliedFields.push("venue");

  // Получаем актуальный slug — либо из create (если был), либо из assignActivitySlugIfMissing
  const activitySlug = activity.slug ?? (
    await prisma.activity.findUnique({ where: { id: activity.id }, select: { slug: true } })
  )?.slug ?? undefined;

  // ── Оптимизация изображения — async, не блокирует ответ ──────────────────
  if (fields.coverImageUrl) {
    void (async () => {
      const imgResult = await optimizeImportedImage(fields.coverImageUrl!, record.id, actorUserId);
      if (imgResult.ok) {
        // Обновляем coverImageUrl на локальный оптимизированный webp
        await prisma.activity.update({
          where: { id: activity.id },
          data: { coverImageUrl: imgResult.publicUrl },
        });
        console.log(`[import-publish] image optimized for activity ${activity.id}: ${imgResult.publicUrl}`);
      } else {
        console.warn(`[import-publish] image optimization failed for activity ${activity.id}: ${imgResult.error}`);
        // Оставляем исходный coverImageUrl — не падаем
      }
    })();
  }

  await persistActivityApplyResult(record.id, activity.id, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_CREATE", appliedFields, skippedFields: [], emptyFields,
    activitySlug,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
  t.mark("persist-apply-result");

  t.end();

  return {
    success: true,
    recordId: record.id,
    decision: "APPROVED_CREATE",
    placeId: activity.id,
    activitySlug,
    appliedFields,
    skippedFields: [],
    emptyFields,
  };
}

// ── EVENT UPDATE ──────────────────────────────────────────────────────────────

async function updateExistingActivityFromImport(
  record: { id: string; normalizedData: NormalizedEventImport },
  targetActivityId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const existingActivity = await prisma.activity.findUnique({
    where: { id: targetActivityId },
    include: { venue: { select: { id: true, title: true, addressLine: true } } },
  });
  if (!existingActivity) return { success: false, recordId: record.id, reason: `Target Activity ${targetActivityId} not found` };

  const nd = record.normalizedData;
  const cityId = nd.cityName ? await lookupCityId(nd.cityName) : null;

  const mappingResult = await mapNormalizedToActivity(nd, cityId);
  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  const { fields, warnings } = mappingResult;

  // Non-destructive filter
  const { updates: candidateUpdates, skipped: skippedNonDestructive } = filterActivityNonDestructiveUpdates(
    fields,
    existingActivity as unknown as Record<string, unknown>,
  );

  // ImportFieldOverride filter
  const overrides = await loadActivityFieldOverrides(targetActivityId);
  const { allowed, skipped: skippedByOverride } = applyOverrideFilter(
    candidateUpdates as Record<string, unknown>,
    overrides,
  );
  const allSkipped = [...skippedNonDestructive, ...skippedByOverride];

  // Если у activity нет placeId — попробовать найти venue Place
  if (!existingActivity.placeId && (nd.venueName || nd.addressText)) {
    const venuePlace = await lookupVenuePlace(nd.venueName, nd.addressText, cityId);
    if (venuePlace) {
      (allowed as Record<string, unknown>).placeId = venuePlace.placeId;
      warnings.push(`venue linked to Place "${venuePlace.placeTitle}" (score=${venuePlace.score.toFixed(2)}, ${venuePlace.reason})`);
    }
  }

  if (Object.keys(allowed).length > 0) {
    await prisma.activity.update({ where: { id: targetActivityId }, data: allowed as never });
  }

  const updatedActivity = await prisma.activity.findUnique({
    where: { id: targetActivityId },
    select: { slug: true },
  });
  const activitySlug = updatedActivity?.slug ?? undefined;

  const emptyFields = Object.keys(fields).filter(
    (k) => !(k in candidateUpdates) && !skippedNonDestructive.some((s) => s.startsWith(k)),
  );

  await persistActivityApplyResult(record.id, targetActivityId, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_UPDATE", appliedFields: Object.keys(allowed), skippedFields: allSkipped, emptyFields,
    activitySlug,
    warnings: warnings.length > 0 ? warnings : undefined,
    note: Object.keys(allowed).length === 0 ? "No fields updated — all blocked or empty" : undefined,
  });

  return {
    success: true,
    recordId: record.id,
    decision: "APPROVED_UPDATE",
    placeId: targetActivityId,
    activitySlug,
    appliedFields: Object.keys(allowed),
    skippedFields: allSkipped,
    emptyFields,
  };
}

// ── EVENT MERGE ───────────────────────────────────────────────────────────────

/**
 * MERGE: additive only — обновляем только пустые поля Activity.
 * Если possibleOccurrenceRisk был при review — scheduleJson/nextOccurrenceAt не трогаем.
 */
async function mergeImportedRecordIntoActivity(
  record: { id: string; normalizedData: NormalizedEventImport },
  targetActivityId: string,
  actorUserId: string,
): Promise<PlaceApplyResult | PlaceApplyValidationError> {
  const existingActivity = await prisma.activity.findUnique({ where: { id: targetActivityId } });
  if (!existingActivity) return { success: false, recordId: record.id, reason: `Target Activity ${targetActivityId} not found` };

  const nd = record.normalizedData;
  const cityId = nd.cityName ? await lookupCityId(nd.cityName) : null;

  const mappingResult = await mapNormalizedToActivity(nd, cityId);
  if ("error" in mappingResult) return { success: false, recordId: record.id, reason: mappingResult.error };

  const { fields, warnings } = mappingResult;

  // MERGE: только пустые поля, scheduleJson/nextOccurrenceAt никогда не трогаем
  const mergeFields: Record<string, unknown> = {};
  const skippedNonEmpty: string[] = [];
  const emptyFields: string[] = [];

  const mergeableFields: [string, unknown][] = [
    ["description", fields.description],
    ["cityId", fields.cityId],
    ["format", fields.format],
    ["priceText", fields.priceText],
    ["priceFrom", fields.priceFrom],
    ["priceTo", fields.priceTo],
    ["ageTags", fields.ageTags],
    ["ageMinMonths", fields.ageMinMonths],
    ["ageMaxMonths", fields.ageMaxMonths],
  ];

  for (const [fieldName, newVal] of mergeableFields) {
    if (newVal === undefined || newVal === null) { emptyFields.push(fieldName); continue; }
    const existingVal = (existingActivity as Record<string, unknown>)[fieldName];
    if (existingVal !== null && existingVal !== undefined && String(existingVal).trim() !== "") {
      skippedNonEmpty.push(fieldName);
    } else {
      mergeFields[fieldName] = newVal;
    }
  }

  // ImportFieldOverride filter
  const overrides = await loadActivityFieldOverrides(targetActivityId);
  const { allowed: mergeAllowed, skipped: skippedByOverride } = applyOverrideFilter(mergeFields, overrides);
  const allSkipped = [...skippedNonEmpty, ...skippedByOverride];

  if (Object.keys(mergeAllowed).length > 0) {
    await prisma.activity.update({ where: { id: targetActivityId }, data: mergeAllowed as never });
  }

  const mergedActivity = await prisma.activity.findUnique({
    where: { id: targetActivityId },
    select: { slug: true },
  });
  const activitySlug = mergedActivity?.slug ?? undefined;

  await persistActivityApplyResult(record.id, targetActivityId, {
    appliedAt: new Date().toISOString(), appliedByUserId: actorUserId,
    decision: "APPROVED_MERGE", appliedFields: Object.keys(mergeAllowed), skippedFields: allSkipped, emptyFields,
    activitySlug,
    warnings: [...(warnings.length > 0 ? warnings : []), "scheduleJson/nextOccurrenceAt not touched in MERGE"],
    note: Object.keys(mergeAllowed).length === 0 ? "No fields merged — all non-empty or locked in target" : undefined,
  });

  return {
    success: true,
    recordId: record.id,
    decision: "APPROVED_MERGE",
    placeId: targetActivityId,
    activitySlug,
    appliedFields: Object.keys(mergeAllowed),
    skippedFields: allSkipped,
    emptyFields,
  };
}
