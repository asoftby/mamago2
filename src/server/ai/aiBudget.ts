import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth/server";
import {
  checkUserBusinessPermission,
  getPartnerCabinetBusiness,
  isPlatformContentStaff,
  type BusinessPermission,
} from "@/server/permissions/business-permissions";

export type PaidAiEndpoint = "rewrite" | "detect-category" | "enrich-event";

export const AI_BUDGET_POLICY = {
  requestWindowMs: 60_000,
  dailyWindowMs: 24 * 60 * 60_000,
  inflightWindowMs: 2 * 60_000,
  user: { requestsPerMinute: 10, unitsPerDay: 200_000, concurrent: 2 },
  business: { requestsPerMinute: 30, unitsPerDay: 1_000_000, concurrent: 6 },
  global: { requestsPerMinute: 200, unitsPerDay: 10_000_000, concurrent: 30 },
  reservationUnits: {
    rewrite: 10_000,
    "detect-category": 4_000,
    "enrich-event": 8_000,
  },
} as const;

export type AiBudgetPrincipal = {
  userId: string;
  accountScope: string;
  accountScopeKind: "business" | "platform";
};

export type CounterReservation = {
  key: string;
  amount: number;
  limit: number;
  windowMs: number;
  event: "AI_RATE_LIMIT_USER" | "AI_RATE_LIMIT_BUSINESS" | "AI_RATE_LIMIT_GLOBAL" | "AI_BUDGET_EXHAUSTED";
  inflight: boolean;
};

export type AiBudgetCounterStore = {
  reserve: (reservations: readonly CounterReservation[], now: Date) => Promise<void>;
  releaseInflight: (reservations: readonly CounterReservation[], now: Date) => Promise<void>;
};

export class AiBudgetExceededError extends Error {
  constructor(public readonly event: CounterReservation["event"] = "AI_BUDGET_EXHAUSTED") {
    super("AI budget exhausted");
    this.name = "AiBudgetExceededError";
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function reservationsFor(
  principal: AiBudgetPrincipal,
  endpoint: PaidAiEndpoint,
): CounterReservation[] {
  const units = AI_BUDGET_POLICY.reservationUnits[endpoint];
  const user = digest(principal.userId);
  const account = digest(principal.accountScope);
  const reservations: CounterReservation[] = [
    { key: `ai:user:req:min:${user}`, amount: 1, limit: AI_BUDGET_POLICY.user.requestsPerMinute, windowMs: AI_BUDGET_POLICY.requestWindowMs, event: "AI_RATE_LIMIT_USER", inflight: false },
    { key: `ai:account:req:min:${account}`, amount: 1, limit: AI_BUDGET_POLICY.business.requestsPerMinute, windowMs: AI_BUDGET_POLICY.requestWindowMs, event: "AI_RATE_LIMIT_BUSINESS", inflight: false },
    { key: "ai:global:req:min", amount: 1, limit: AI_BUDGET_POLICY.global.requestsPerMinute, windowMs: AI_BUDGET_POLICY.requestWindowMs, event: "AI_RATE_LIMIT_GLOBAL", inflight: false },
    { key: `ai:user:units:day:${user}`, amount: units, limit: AI_BUDGET_POLICY.user.unitsPerDay, windowMs: AI_BUDGET_POLICY.dailyWindowMs, event: "AI_BUDGET_EXHAUSTED", inflight: false },
    { key: `ai:account:units:day:${account}`, amount: units, limit: AI_BUDGET_POLICY.business.unitsPerDay, windowMs: AI_BUDGET_POLICY.dailyWindowMs, event: "AI_BUDGET_EXHAUSTED", inflight: false },
    { key: "ai:global:units:day", amount: units, limit: AI_BUDGET_POLICY.global.unitsPerDay, windowMs: AI_BUDGET_POLICY.dailyWindowMs, event: "AI_BUDGET_EXHAUSTED", inflight: false },
    { key: `ai:user:inflight:${user}`, amount: 1, limit: AI_BUDGET_POLICY.user.concurrent, windowMs: AI_BUDGET_POLICY.inflightWindowMs, event: "AI_RATE_LIMIT_USER", inflight: true },
    { key: `ai:account:inflight:${account}`, amount: 1, limit: AI_BUDGET_POLICY.business.concurrent, windowMs: AI_BUDGET_POLICY.inflightWindowMs, event: "AI_RATE_LIMIT_BUSINESS", inflight: true },
    { key: "ai:global:inflight", amount: 1, limit: AI_BUDGET_POLICY.global.concurrent, windowMs: AI_BUDGET_POLICY.inflightWindowMs, event: "AI_RATE_LIMIT_GLOBAL", inflight: true },
  ];
  return reservations.sort((left, right) => left.key.localeCompare(right.key));
}

async function incrementCounter(
  tx: Prisma.TransactionClient,
  reservation: CounterReservation,
  now: Date,
): Promise<number> {
  const resetAt = new Date(now.getTime() + reservation.windowMs);
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitEntry" ("key", "count", "resetAt")
    VALUES (${reservation.key}, ${reservation.amount}, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitEntry"."resetAt" <= ${now} THEN ${reservation.amount}
        ELSE "RateLimitEntry"."count" + ${reservation.amount}
      END,
      "resetAt" = CASE
        WHEN "RateLimitEntry"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitEntry"."resetAt"
      END
    RETURNING "count"
  `;
  return Number(rows[0]?.count ?? Number.POSITIVE_INFINITY);
}

const postgresCounterStore: AiBudgetCounterStore = {
  reserve: async (reservations, now) => {
    await prisma.$transaction(async (tx) => {
      for (const reservation of reservations) {
        const count = await incrementCounter(tx, reservation, now);
        if (!Number.isFinite(count) || count > reservation.limit) {
          throw new AiBudgetExceededError(reservation.event);
        }
      }
    });
  },
  releaseInflight: async (reservations, now) => {
    const inflight = reservations.filter((reservation) => reservation.inflight);
    await prisma.$transaction(
      inflight.map((reservation) =>
        prisma.$executeRaw`
          UPDATE "RateLimitEntry"
          SET "count" = GREATEST(0, "count" - ${reservation.amount})
          WHERE "key" = ${reservation.key} AND "resetAt" > ${now}
        `,
      ),
    );
  },
};

export function createAiBudgetController(
  store: AiBudgetCounterStore,
  now: () => Date = () => new Date(),
) {
  return async function withBudget<T>(params: {
    principal: AiBudgetPrincipal;
    endpoint: PaidAiEndpoint;
    operation: () => Promise<T>;
    logSecurityEvent?: (event: string) => void;
  }): Promise<T> {
    const reservations = reservationsFor(params.principal, params.endpoint);
    try {
      await store.reserve(reservations, now());
    } catch (error) {
      const event = error instanceof AiBudgetExceededError ? error.event : "AI_BUDGET_EXHAUSTED";
      params.logSecurityEvent?.(event);
      throw error instanceof AiBudgetExceededError ? error : new AiBudgetExceededError();
    }

    try {
      return await params.operation();
    } catch (error) {
      params.logSecurityEvent?.("AI_PROVIDER_FAILURE");
      throw error;
    } finally {
      try {
        await store.releaseInflight(reservations, now());
      } catch {
        // Fail closed until the short in-flight TTL expires.
        params.logSecurityEvent?.("AI_BUDGET_EXHAUSTED");
      }
    }
  };
}

export const withAiBudget = createAiBudgetController(postgresCounterStore);

export async function resolveAiBudgetPrincipal(
  user: CurrentUser,
  permission: BusinessPermission,
): Promise<AiBudgetPrincipal | null> {
  if (isPlatformContentStaff(user.role)) {
    return { userId: user.id, accountScope: "platform-editorial", accountScopeKind: "platform" };
  }

  const business = await getPartnerCabinetBusiness(user.id);
  if (!business || !(await checkUserBusinessPermission(user, business.id, permission))) {
    return null;
  }
  return { userId: user.id, accountScope: business.id, accountScopeKind: "business" };
}
