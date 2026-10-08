import type { PrismaClient } from "@prisma/client";
import { ageYearsAt } from "@/lib/child/birth";
import { DEFAULT_NOTIFICATION_TIME_ZONE, isValidTimeZone } from "@/lib/notifications/userNotificationSchedule";
import type { PlanOwner } from "@/server/services/planOwner";
import type { RuleChild, RulePlaceCandidate, RulePlanCandidate } from "./captureRules";
import { resolveOwnerCity, type OwnerCity, type OwnerCityDeps } from "./ownerCity";
import { resolvePlaceCandidates, type PlaceCandidateDeps } from "./placeCandidates";

/**
 * Backend-built context for the parser (spec section 7.2). The model only ever
 * sees: time zone, anchor, children {id,name,age}, TELEGRAM_FORWARD plan
 * candidates {id,title,childId,startsAt} and a Place shortlist. No catalogue
 * Activity, no other user/child fields.
 */
export const PLAN_CANDIDATE_WINDOW_BEFORE_DAYS = 2;
export const PLAN_CANDIDATE_WINDOW_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CaptureContext = {
  timeZone: string;
  anchorAt: Date;
  anchorIsForward: boolean;
  children: RuleChild[];
  planCandidates: RulePlanCandidate[];
  placeShortlist: RulePlaceCandidate[];
  city: OwnerCity;
};

export type CaptureContextDeps = {
  db: Pick<PrismaClient, "userNotificationSchedule" | "child" | "planItem" | "place">;
  city: OwnerCityDeps;
  places: Pick<PlaceCandidateDeps, "publicPlaceWhere">;
};

export async function loadCaptureContext(
  deps: CaptureContextDeps,
  owner: PlanOwner,
  input: { anchorAt: Date; anchorIsForward: boolean; text: string },
): Promise<CaptureContext> {
  const { db } = deps;
  const { anchorAt } = input;

  const [schedule, childRows, planRows, city] = await Promise.all([
    db.userNotificationSchedule.findUnique({ where: { userId: owner.userId }, select: { timeZone: true } }),
    db.child.findMany({
      where: { parentId: owner.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, birthDate: true, birthPrecision: true },
    }),
    db.planItem.findMany({
      where: {
        userId: owner.userId,
        source: "TELEGRAM_FORWARD",
        cancelledAt: null,
        startsAt: {
          gte: new Date(anchorAt.getTime() - PLAN_CANDIDATE_WINDOW_BEFORE_DAYS * DAY_MS),
          lte: new Date(anchorAt.getTime() + PLAN_CANDIDATE_WINDOW_AFTER_DAYS * DAY_MS),
        },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, childId: true, startsAt: true },
    }),
    resolveOwnerCity(deps.city, owner),
  ]);

  const timeZone =
    schedule?.timeZone && isValidTimeZone(schedule.timeZone) ? schedule.timeZone : DEFAULT_NOTIFICATION_TIME_ZONE;

  const children: RuleChild[] = childRows.map((child) => ({
    id: child.id,
    name: child.name,
    age: ageYearsAt({ birthDate: child.birthDate, birthPrecision: child.birthPrecision }, anchorAt),
  }));

  const placeShortlist = await resolvePlaceCandidates(
    { db, publicPlaceWhere: deps.places.publicPlaceWhere },
    owner,
    city.cityId,
    input.text,
  );

  return {
    timeZone,
    anchorAt,
    anchorIsForward: input.anchorIsForward,
    children,
    planCandidates: planRows,
    placeShortlist,
    city,
  };
}
