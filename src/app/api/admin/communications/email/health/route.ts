import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";
import { emailService } from "@/features/email/server/email-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailHealthStatus = "OK" | "CONFIGURED" | "DEGRADED" | "MISCONFIGURED";

function deriveStatus(params: {
  enabled: boolean;
  configured: boolean;
  debugRedirect: boolean;
  sent1h: number;
  failed1h: number;
}): EmailHealthStatus {
  if (!params.enabled || !params.configured) return "MISCONFIGURED";
  if (isProductionAppEnv() && params.debugRedirect) return "MISCONFIGURED";

  // A provider-side credential failure (for example a revoked Resend API key)
  // is invisible to env-only checks. Any recent FAILED attempt must therefore
  // degrade the channel even when other attempts also succeeded.
  if (params.failed1h > 0) return "DEGRADED";

  // Only a real successful delivery attempt is evidence that the current
  // credentials/provider path work. With no recent attempts, expose a neutral
  // CONFIGURED state rather than a false-green "OK".
  if (params.sent1h > 0) return "OK";
  return "CONFIGURED";
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const config = emailService.getHealth();

  const [sent1h, failed1h, skipped1h, pending1h, lastSuccessful, lastFailure] =
    await Promise.all([
      prisma.notificationDelivery.count({
        where: { channel: "EMAIL", status: "SENT", createdAt: { gte: oneHourAgo, lt: now } },
      }),
      prisma.notificationDelivery.count({
        where: { channel: "EMAIL", status: "FAILED", createdAt: { gte: oneHourAgo, lt: now } },
      }),
      prisma.notificationDelivery.count({
        where: { channel: "EMAIL", status: "SKIPPED", createdAt: { gte: oneHourAgo, lt: now } },
      }),
      prisma.notificationDelivery.count({
        where: { channel: "EMAIL", status: "PENDING", createdAt: { gte: oneHourAgo, lt: now } },
      }),
      prisma.notificationDelivery.findFirst({
        where: { channel: "EMAIL", status: "SENT", sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
      prisma.notificationDelivery.findFirst({
        where: { channel: "EMAIL", status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, errorMessage: true },
      }),
    ]);

  return NextResponse.json({
    ok: true,
    provider: "resend",
    status: deriveStatus({
      enabled: config.enabled,
      configured: config.configured,
      debugRedirect: config.debugRedirect,
      sent1h,
      failed1h,
    }),
    checkedAt: now.toISOString(),
    config: {
      enabled: config.enabled,
      configured: config.configured,
      missingKeys: config.missingKeys,
      debugRedirect: config.debugRedirect,
      from: config.from,
      replyTo: config.replyTo,
      publicUrl: config.publicUrl,
    },
    deliveries1h: {
      sent: sent1h,
      failed: failed1h,
      skipped: skipped1h,
      pending: pending1h,
    },
    lastSuccessfulAt: lastSuccessful?.sentAt?.toISOString() ?? null,
    lastFailure: lastFailure
      ? {
          at: lastFailure.updatedAt.toISOString(),
          reason: lastFailure.errorMessage,
        }
      : null,
  });
}
