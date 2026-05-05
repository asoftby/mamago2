import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function guestMaxLifetimeGenerations(): number {
  const raw = process.env.GUEST_MAX_GENERATIONS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 10_000);
  }
  return 2;
}

/** См. env GUEST_MAX_GENERATIONS_PER_MINUTE; без env — 60/мин. */
function guestMaxGenerationsPerMinute(): number {
  const raw = process.env.GUEST_MAX_GENERATIONS_PER_MINUTE;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 10_000);
  }
  return 60;
}

/** Канонический UUID (crypto.randomUUID и др.) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveGuestUsageKey(
  clientAnonymousId: string | null | undefined,
  ip: string | null,
  /** Разделяет гостей за одним IP (разные браузеры), если нет валидного anonymousId */
  userAgent?: string | null,
): string | null {
  const raw =
    typeof clientAnonymousId === "string" ? clientAnonymousId.trim() : "";
  if (raw && UUID_RE.test(raw)) {
    return `anon:${raw}`;
  }
  const trimmedIp = ip?.split(",")[0]?.trim();
  if (trimmedIp && trimmedIp.length > 0) {
    const pepper =
      process.env.GUEST_USAGE_IP_PEPPER ?? "mamago-guest-ip-pepper-dev";
    const uaSnippet =
      typeof userAgent === "string" ? userAgent.trim().slice(0, 256) : "";
    const hash = createHash("sha256")
      .update(`${pepper}:${trimmedIp}:${uaSnippet}`)
      .digest("hex")
      .slice(0, 48);
    return `iph:${hash}`;
  }
  return null;
}

export type GuestQuickGateResult =
  | { blocked: false }
  | { blocked: true; reason: "requires_auth" | "rate_limited" };

/**
 * Быстрая проверка без списания (скользящее окно минуты + лимит за всё время).
 * Итоговое решение всё равно делает recordGuestSuccessfulGeneration.
 */
export async function quickGuestQuotaGate(
  key: string,
): Promise<GuestQuickGateResult> {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const maxLife = guestMaxLifetimeGenerations();
  const maxPerMin = guestMaxGenerationsPerMinute();

  const row = await prisma.guestUsage.findUnique({
    where: { anonymousId: key },
    select: {
      generationsCount: true,
      rateMinuteBucket: true,
      rateCountInMinute: true,
    },
  });

  if (!row) return { blocked: false };

  if (row.generationsCount >= maxLife) {
    return { blocked: true, reason: "requires_auth" };
  }

  let bucket = row.rateMinuteBucket ?? minuteBucket;
  let count = row.rateCountInMinute ?? 0;
  if (bucket !== minuteBucket) {
    bucket = minuteBucket;
    count = 0;
  }
  if (count >= maxPerMin) {
    return { blocked: true, reason: "rate_limited" };
  }

  return { blocked: false };
}

export type RecordGuestGenerationResult =
  | { ok: true; remainingGenerations: number }
  | { ok: false; reason: "requires_auth" | "rate_limited" | "error" };

/**
 * Списывает квоту только после успешной подборки списка активностей.
 * Раньше счётчик минуты рос до запроса к БД подборки — ошибки и отмены «съедали» лимит.
 */
export async function recordGuestSuccessfulGeneration(
  key: string,
): Promise<RecordGuestGenerationResult> {
  const maxLife = guestMaxLifetimeGenerations();
  const maxPerMin = guestMaxGenerationsPerMinute();
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const minuteBucket = Math.floor(Date.now() / 60_000);

    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          let row = await tx.guestUsage.findUnique({
            where: { anonymousId: key },
          });

          if (!row) {
            await tx.guestUsage.create({
              data: {
                anonymousId: key,
                generationsCount: 1,
                rateMinuteBucket: minuteBucket,
                rateCountInMinute: 1,
              },
            });
            return {
              kind: "ok" as const,
              remaining: Math.max(0, maxLife - 1),
            };
          }

          if (row.generationsCount >= maxLife) {
            return { kind: "requires_auth" as const };
          }

          let bucket = row.rateMinuteBucket ?? minuteBucket;
          let count = row.rateCountInMinute ?? 0;
          if (bucket !== minuteBucket) {
            bucket = minuteBucket;
            count = 0;
          }
          if (count >= maxPerMin) {
            return { kind: "rate_limited" as const };
          }

          const updated = await tx.guestUsage.update({
            where: { anonymousId: key },
            data: {
              generationsCount: { increment: 1 },
              rateMinuteBucket: bucket,
              rateCountInMinute: count + 1,
            },
            select: { generationsCount: true },
          });

          return {
            kind: "ok" as const,
            remaining: Math.max(0, maxLife - updated.generationsCount),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 4000,
          timeout: 8000,
        },
      );

      if (outcome.kind === "ok") {
        return { ok: true, remainingGenerations: outcome.remaining };
      }
      if (outcome.kind === "requires_auth") {
        return { ok: false, reason: "requires_auth" };
      }
      return { ok: false, reason: "rate_limited" };
    } catch (e) {
      const retry =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P2034" || e.code === "P2028");

      if (retry && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
        continue;
      }

      console.error("[guest quota] recordGuestSuccessfulGeneration", e);
      return { ok: false, reason: "error" };
    }
  }

  console.error(
    "[guest quota] recordGuestSuccessfulGeneration: retries exhausted",
  );
  return { ok: false, reason: "error" };
}
