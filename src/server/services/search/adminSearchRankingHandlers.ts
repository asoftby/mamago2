import prisma from "@/lib/prisma";
import type { AuthActor } from "@/lib/auth/safeUser";

/**
 * Audit finding (2026-08): SearchRankingSettings.* is saved but never read by
 * any production search/ranking code (confirmed by exhaustive grep across
 * src/ — search ranking actually uses the hardcoded SEARCH_BOOST constants in
 * src/lib/search/constants.ts). Mutations are locked read-only pending the
 * Ranking redesign. Do not re-enable without first wiring these fields into
 * an actual scoring path.
 *
 * Auth resolution (cookies() via next/headers) cannot run outside a real
 * Next.js request scope, so the route.ts wrapper resolves `actor` via
 * getCurrentUser() and passes it in here — this module is the testable core.
 */

const READ_ONLY_ERROR =
  "Эти настройки не влияют на production ranking (подтверждено аудитом) и временно доступны только для чтения до завершения редизайна Ranking.";

export function isSearchRankingAdmin(actor: AuthActor | null): actor is AuthActor {
  return !!actor && actor.role === "ADMIN";
}

export type HandlerResult = { status: number; body: unknown };

export async function handleSearchRankingGet(actor: AuthActor | null): Promise<HandlerResult> {
  if (!isSearchRankingAdmin(actor)) {
    return { status: 401, body: { success: false, error: "Unauthorized" } };
  }

  let settings = await prisma.searchRankingSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!settings) {
    settings = await prisma.searchRankingSettings.create({
      data: {
        nearbyBoost: 50,
        freshnessBoost: 30,
        popularityBoost: 40,
        partnerBoost: 20,
        ageBoost: 60,
        cityBoost: 70,
      },
    });
  }

  return { status: 200, body: { success: true, data: { settings } } };
}

export function handleSearchRankingMutation(actor: AuthActor | null): HandlerResult {
  if (!isSearchRankingAdmin(actor)) {
    return { status: 401, body: { success: false, error: "Unauthorized" } };
  }
  return { status: 403, body: { success: false, error: READ_ONLY_ERROR } };
}
