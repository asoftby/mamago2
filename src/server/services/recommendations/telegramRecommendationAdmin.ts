import {
  AnalyticsEntityType,
  RecommendationSurface,
  type Prisma,
} from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import type { AuthActor } from "@/lib/auth/safeUser";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";
import {
  PLAN_SUGGESTION_ALGORITHM_VERSION,
  rankPlanSuggestionsForCity,
} from "@/server/services/planSuggestions.service";
import {
  DEFAULT_TELEGRAM_RECOMMENDATION_POLICY,
  applyTelegramSurfacePolicy,
  normalizeTelegramRecommendationPolicyConfig,
  type TelegramRecommendationPolicyConfig,
} from "./telegramSurfacePolicy";

const TELEGRAM_SURFACE = RecommendationSurface.TELEGRAM;

export class RecommendationPolicyConflictError extends Error {
  constructor(message = "Recommendation policy changed. Reload and retry.") {
    super(message);
    this.name = "RecommendationPolicyConflictError";
  }
}

function isConcurrentPolicyWrite(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "P2034";
}

function requiredExpectedUpdatedAt(value: string | null | undefined): Date {
  if (!value) throw new RecommendationPolicyConflictError();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new RecommendationPolicyConflictError();
  return parsed;
}

function dateKeyPlusDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function validDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function publicPolicyRow(row: {
  id: string;
  version: number;
  status: string;
  algorithmVersion: string;
  config: Prisma.JsonValue;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} | null) {
  if (!row) return null;
  return {
    ...row,
    config: normalizeTelegramRecommendationPolicyConfig(row.config),
  };
}

export async function getTelegramRecommendationPolicyState() {
  const [draft, published] = await Promise.all([
    prisma.recommendationSurfacePolicy.findFirst({
      where: { surface: TELEGRAM_SURFACE, status: "DRAFT" },
      orderBy: { version: "desc" },
    }),
    prisma.recommendationSurfacePolicy.findFirst({
      where: { surface: TELEGRAM_SURFACE, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    }),
  ]);

  return {
    surface: TELEGRAM_SURFACE,
    algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
    defaults: { ...DEFAULT_TELEGRAM_RECOMMENDATION_POLICY },
    draft: publicPolicyRow(draft),
    published: publicPolicyRow(published),
    effectiveConfig: published
      ? normalizeTelegramRecommendationPolicyConfig(published.config)
      : { ...DEFAULT_TELEGRAM_RECOMMENDATION_POLICY },
    deliveryEnabled: false,
  };
}

export async function saveTelegramRecommendationPolicyDraft(input: {
  actor: AuthActor;
  config: unknown;
  expectedUpdatedAt?: string | null;
}) {
  const config = normalizeTelegramRecommendationPolicyConfig(input.config);
  const before = await prisma.recommendationSurfacePolicy.findFirst({
    where: { surface: TELEGRAM_SURFACE, status: "DRAFT" },
    orderBy: { version: "desc" },
  });

  let updated;
  try {
    if (before) {
      const expectedUpdatedAt = requiredExpectedUpdatedAt(input.expectedUpdatedAt);
      const mutationAt = new Date();
      const claimed = await prisma.recommendationSurfacePolicy.updateMany({
        where: {
          id: before.id,
          surface: TELEGRAM_SURFACE,
          status: "DRAFT",
          updatedAt: expectedUpdatedAt,
        },
        data: {
          algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
          config,
          createdByUserId: input.actor.id,
          updatedAt: mutationAt,
        },
      });
      if (claimed.count !== 1) throw new RecommendationPolicyConflictError();
      updated = await prisma.recommendationSurfacePolicy.findUnique({ where: { id: before.id } });
      if (!updated) throw new RecommendationPolicyConflictError();
    } else {
      updated = await prisma.$transaction(async (tx) => {
        const latest = await tx.recommendationSurfacePolicy.aggregate({
          where: { surface: TELEGRAM_SURFACE },
          _max: { version: true },
        });
        return tx.recommendationSurfacePolicy.create({
          data: {
            surface: TELEGRAM_SURFACE,
            version: (latest._max.version ?? 0) + 1,
            status: "DRAFT",
            algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
            config,
            createdByUserId: input.actor.id,
          },
        });
      });
    }
  } catch (error) {
    if (error instanceof RecommendationPolicyConflictError || isConcurrentPolicyWrite(error)) {
      throw new RecommendationPolicyConflictError();
    }
    throw error;
  }

  await logAdminAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "RECOMMENDATION_TELEGRAM_POLICY_DRAFT_SAVE",
    entityType: "RECOMMENDATION_SURFACE_POLICY",
    entityId: updated.id,
    before: before ? { version: before.version, config: before.config } : null,
    after: { version: updated.version, config: updated.config },
  });

  return publicPolicyRow(updated);
}

export async function publishTelegramRecommendationPolicy(input: {
  actor: AuthActor;
  config: unknown;
  expectedUpdatedAt?: string | null;
}) {
  const config = normalizeTelegramRecommendationPolicyConfig(input.config);
  const existingDraft = await prisma.recommendationSurfacePolicy.findFirst({
    where: { surface: TELEGRAM_SURFACE, status: "DRAFT" },
    orderBy: { version: "desc" },
  });

  let published;
  try {
    published = await prisma.$transaction(async (tx) => {
      const mutationAt = new Date();
      let draft;

      if (existingDraft) {
        const expectedUpdatedAt = requiredExpectedUpdatedAt(input.expectedUpdatedAt);
        const claimed = await tx.recommendationSurfacePolicy.updateMany({
          where: {
            id: existingDraft.id,
            surface: TELEGRAM_SURFACE,
            status: "DRAFT",
            updatedAt: expectedUpdatedAt,
          },
          data: {
            algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
            config,
            createdByUserId: input.actor.id,
            updatedAt: mutationAt,
          },
        });
        if (claimed.count !== 1) throw new RecommendationPolicyConflictError();
        draft = await tx.recommendationSurfacePolicy.findUnique({ where: { id: existingDraft.id } });
        if (!draft) throw new RecommendationPolicyConflictError();
      } else {
        const latest = await tx.recommendationSurfacePolicy.aggregate({
          where: { surface: TELEGRAM_SURFACE },
          _max: { version: true },
        });
        draft = await tx.recommendationSurfacePolicy.create({
          data: {
            surface: TELEGRAM_SURFACE,
            version: (latest._max.version ?? 0) + 1,
            status: "DRAFT",
            algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
            config,
            createdByUserId: input.actor.id,
            updatedAt: mutationAt,
          },
        });
      }

      await tx.recommendationSurfacePolicy.updateMany({
        where: {
          surface: TELEGRAM_SURFACE,
          status: "PUBLISHED",
          id: { not: draft.id },
        },
        data: { status: "ARCHIVED", archivedAt: mutationAt },
      });

      const publishedAt = new Date();
      const promoted = await tx.recommendationSurfacePolicy.updateMany({
        where: {
          id: draft.id,
          surface: TELEGRAM_SURFACE,
          status: "DRAFT",
          updatedAt: mutationAt,
        },
        data: {
          status: "PUBLISHED",
          publishedAt,
          archivedAt: null,
          updatedAt: publishedAt,
        },
      });
      if (promoted.count !== 1) throw new RecommendationPolicyConflictError();

      const row = await tx.recommendationSurfacePolicy.findUnique({ where: { id: draft.id } });
      if (!row) throw new RecommendationPolicyConflictError();
      return row;
    });
  } catch (error) {
    if (error instanceof RecommendationPolicyConflictError || isConcurrentPolicyWrite(error)) {
      throw new RecommendationPolicyConflictError();
    }
    throw error;
  }

  await logAdminAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "RECOMMENDATION_TELEGRAM_POLICY_PUBLISH",
    entityType: "RECOMMENDATION_SURFACE_POLICY",
    entityId: published.id,
    before: existingDraft
      ? { version: existingDraft.version, status: existingDraft.status, config: existingDraft.config }
      : null,
    after: { version: published.version, status: published.status, config: published.config },
  });

  return publicPolicyRow(published);
}

export async function previewTelegramRecommendations(input: {
  config: unknown;
  citySlug?: unknown;
  dateFrom?: unknown;
  ageRanges?: unknown;
  userEmail?: unknown;
}) {
  const config = normalizeTelegramRecommendationPolicyConfig(input.config);
  const citySlug =
    typeof input.citySlug === "string" && input.citySlug.trim()
      ? input.citySlug.trim().toLowerCase()
      : "minsk";
  const dateFrom = validDateKey(input.dateFrom)
    ? input.dateFrom
    : formatInTimeZone(new Date(), DEFAULT_TZ, "yyyy-MM-dd");
  const dateTo = dateKeyPlusDays(dateFrom, config.horizonDays - 1);
  const ageRanges = Array.isArray(input.ageRanges)
    ? input.ageRanges.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const userEmail =
    typeof input.userEmail === "string" && input.userEmail.trim()
      ? input.userEmail.trim().toLowerCase()
      : null;

  const user = userEmail
    ? await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, email: true },
      })
    : null;

  const cooldownEntityIds = new Set<string>();
  if (user && config.repeatCooldownDays > 0) {
    const since = new Date(Date.now() - config.repeatCooldownDays * 86_400_000);
    const recent = await prisma.recommendationExposure.findMany({
      where: {
        entityType: AnalyticsEntityType.EVENT,
        exposedAt: { gte: since },
        run: {
          surface: TELEGRAM_SURFACE,
          userId: user.id,
        },
      },
      select: { entityId: true },
    });
    for (const row of recent) cooldownEntityIds.add(row.entityId);
  }

  const ranked = await rankPlanSuggestionsForCity({
    citySlug,
    excludeActivityIds: [],
    ageRangeValues: ageRanges,
    dateFrom,
    dateTo,
    exhaustiveCandidatePool: true,
  });

  const composed = applyTelegramSurfacePolicy({
    ranked: ranked.suggestions,
    config,
    cooldownEntityIds,
  });

  return {
    previewOnly: true,
    surface: TELEGRAM_SURFACE,
    algorithmVersion: ranked.algorithmVersion,
    policy: config,
    context: {
      citySlug,
      dateFrom,
      dateTo,
      ageRanges,
      userEmail,
      userFound: Boolean(user),
      cooldownApplied: Boolean(user && config.repeatCooldownDays > 0),
    },
    candidateCount: ranked.candidateCount,
    rankedCount: ranked.suggestions.length,
    selectedCount: composed.selected.length,
    noSendReason: composed.noSendReason,
    filtered: composed.filtered,
    suggestions: composed.selected.map((item, index) => ({
      id: item.activity.id,
      slug: item.activity.slug,
      title: item.activity.title,
      category: item.activity.eventCategory?.nameRu ?? null,
      ageLabel: item.activity.ageLabel,
      score: item.score,
      position: index + 1,
      reasonCodes: item.reasonCodes,
      scoreBreakdown: item.scoreBreakdown,
    })),
  };
}

export type TelegramPolicyState = Awaited<ReturnType<typeof getTelegramRecommendationPolicyState>>;
export type TelegramPolicyConfig = TelegramRecommendationPolicyConfig;
