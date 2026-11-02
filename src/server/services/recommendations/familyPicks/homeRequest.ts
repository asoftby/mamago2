import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SafeOpaqueIdSchema } from "@/lib/decision/identifiers";
import { homeFamilyPicksEnabled } from "@/features/city-home/lib/familyHome";
import { saveHomeSelection, loadHomeContext } from "./homeContext";
import { deliverHomeFamilyPicks } from "./delivery";
import { verifyRecommendationAttribution } from "../RecommendationTraceService";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getPublicActivityDetailWhere } from "@/server/public/publicContentVisibility";

const city = z.string().regex(/^[a-z0-9-]{1,64}$/);
const choice = SafeOpaqueIdSchema.nullable().default(null);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("context"), city }),
  z.object({ action: z.literal("selection"), city, selectedChildId: choice, version: z.string().datetime().nullable() }),
  z.object({ action: z.literal("recommend"), city, selectedChildId: choice, signature: z.string().length(64),
    dismissedIds: z.array(SafeOpaqueIdSchema).max(200).default([]) }),
  z.object({ action: z.literal("dismiss"), city, eventId: SafeOpaqueIdSchema, exposureId: SafeOpaqueIdSchema.nullable(), token: SafeOpaqueIdSchema }),
]);
const defaults = { saveSelection: saveHomeSelection, context: loadHomeContext, deliver: deliverHomeFamilyPicks, verify: verifyRecommendationAttribution, track: trackUserEvent,
  publicEvent: async (id: string): Promise<{ id: string } | null> => prisma.activity.findFirst({ where: { AND: [{ id }, getPublicActivityDetailWhere()] }, select: { id: true } }) };

export async function resolveHomeRequest(raw: unknown, userId: string | null, sessionId: string | null, deps = defaults, enabled = homeFamilyPicksEnabled(), signal?: AbortSignal) {
  if (!enabled) return { status: 409, body: { error: "home_policy_disabled" } };
  if (!userId) return { status: 401, body: { error: "authentication_required" } };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "invalid_request" } };
  const data = parsed.data;
  if (data.action === "dismiss") {
    const attribution = data.exposureId ? await deps.verify({ exposureId: data.exposureId, entityType: "EVENT", entityId: data.eventId, userId }) : null;
    if (data.exposureId ? !attribution : !await deps.publicEvent(data.eventId)) return { status: 404, body: { error: "event_unavailable" } };
    const result = await deps.track({ userId, sessionId, eventType: "DISMISS", entityType: "EVENT", entityId: data.eventId, citySlug: data.city, vertical: "CITY",
      idempotencyKey: `home-dismiss:${userId}:${data.token}`,
      meta: { source: attribution ? "recommendation" : "listing", section: "home", placement: "HOME_FOR_FAMILY",
        ...(attribution ? { recommendationExposureId: attribution.exposureId, recommendationRunId: attribution.runId, recommendationSurface: "home" } : {}) } });
    return result.ok ? { status: 200, body: { ok: true } } : { status: 503, body: { error: "dismiss_not_saved" } };
  }
  const { profile, context } = await deps.context(userId);
  if (data.action === "context") return { status: 200, body: { context } };
  if (data.selectedChildId && !profile.children.some(child => child.id === data.selectedChildId)) return { status: 404, body: { error: "selection_unavailable" } };
  if (data.action === "selection") {
    const saved = await deps.saveSelection(userId, data.selectedChildId, data.version);
    return saved ? { status: 200, body: { ok: true } } : { status: 409, body: { error: "selection_changed" } };
  }
  if (context.audience !== "personalized" || data.signature !== context.signature) return { status: 409, body: { error: "profile_changed", context } };
  const delivery = await deps.deliver({ userId, citySlug: data.city, profile, context, sessionId, signal, dismissedIds: data.dismissedIds,
    selection: data.selectedChildId ? { mode: "CHILD", selectedChildId: data.selectedChildId } : { mode: "ALL_FAMILY" } });
  return { status: 200, body: delivery };
}
