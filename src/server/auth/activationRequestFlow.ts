import { prisma } from "@/lib/prisma";
import { deliverMigratedAccountActivationEmail } from "./activationEmailDelivery";
import { classifyActivationEmailBlock, type ActivationEmailEnvironment } from "./activationEmailGate";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
} from "./activationRateLimit";
import { issueUserActionToken } from "./userActionToken.service";

/**
 * The one place that turns "someone wants this email to get an activation
 * link" into a rate-limited lookup + token issuance + provider send +
 * delivery-audit row. Both entry points — the standalone
 * `/api/auth/activation/request` endpoint and the migrated-user branch of
 * `/api/auth/login` — call this instead of duplicating the flow.
 *
 * Internal failures (lookup miss, rate limit, issuance, delivery, even an
 * audit-write error) never throw — they all collapse to `{ delivered:
 * false }`. The anonymous `/request` endpoint still ignores the return
 * value entirely and always sends its own identical generic response (no
 * oracle for that surface); the login flow *does* read `delivered` — the
 * founder's product decision is that a user who already typed a real
 * registered email and a password is told the truth about whether a link
 * actually went out, which is a different anonymity boundary than the
 * anonymous request endpoint's "don't confirm the account exists at all".
 */
export type ActivationRequestSource = "LOGIN_FLOW" | "MANUAL_REQUEST" | "PRODUCTION_BATCH";

export type ActivationRequestOutcome = { delivered: boolean };

const PROVIDER = "resend";
const TEMPLATE = "migrated-account-activation-v1";

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

async function lookupSourceRecordKey(userId: string): Promise<string | null> {
  const lineage = await prisma.migrationLineage.findFirst({
    where: { targetType: "USER", targetId: userId, isActive: true },
    select: { sourceRecordKey: true },
  });
  return lineage?.sourceRecordKey ?? null;
}

export async function requestMigratedAccountActivationByEmail(
  params: {
    /** Already normalized (trim + lowercase) by the caller. */
    email: string;
    /** `null` skips the IP-scoped limiter — matches the existing endpoint's own "no trusted IP => do nothing" policy. */
    ip: string | null;
    source: ActivationRequestSource;
  },
  /** Test-only seams — mirror deliverMigratedAccountActivationEmail's own injectable sender/gate pattern. Production callers never pass these. */
  overrides: {
    sender?: Parameters<typeof deliverMigratedAccountActivationEmail>[1];
    gateEnvironment?: ActivationEmailEnvironment;
  } = {},
): Promise<ActivationRequestOutcome> {
  try {
    if (params.ip) {
      const ipLimit = await checkActivationRateLimit({
        key: activationRateLimitKey("request-ip", params.ip),
        limit: 10,
        windowMs: 60 * 60 * 1000,
      });
      if (!ipLimit.allowed) return { delivered: false };
    }
    const emailLimit = await checkActivationRateLimit({
      key: activationRateLimitKey("request-email", params.email),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!emailLimit.allowed) return { delivered: false };

    const user = await prisma.user.findFirst({
      where: { email: { equals: params.email, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!user) return { delivered: false };

    const recipientMask = maskEmail(user.email);
    const sourceRecordKey = await lookupSourceRecordKey(user.id);

    // Token issuance always happens, independent of whether delivery is
    // currently allowed — exactly the original endpoint's behavior. LOCAL/DEV
    // and a not-yet-approved production still need a real, usable token for
    // manual/admin-assisted activation and for tests/rehearsal; only the
    // EMAIL SEND is gated, never the token itself. Eligibility
    // (PENDING_ACTIVATION, not deleted) is enforced inside issueUserActionToken.
    const issued = await issueUserActionToken({
      userId: user.id,
      purpose: "MIGRATED_ACCOUNT_ACTIVATION",
    });

    const blockReason = classifyActivationEmailBlock(overrides.gateEnvironment);
    if (blockReason) {
      await prisma.activationDeliveryAudit.create({
        data: {
          userId: user.id,
          sourceRecordKey,
          provider: PROVIDER,
          recipientMask,
          template: TEMPLATE,
          status: blockReason === "ENVIRONMENT" ? "BLOCKED_ENVIRONMENT" : "BLOCKED_KILL_SWITCH",
          activationTokenId: issued.id,
          source: params.source,
        },
      });
      return { delivered: false };
    }

    const audit = await prisma.activationDeliveryAudit.create({
      data: {
        userId: user.id,
        sourceRecordKey,
        provider: PROVIDER,
        recipientMask,
        template: TEMPLATE,
        status: "QUEUED",
        activationTokenId: issued.id,
        source: params.source,
      },
    });

    const result = await deliverMigratedAccountActivationEmail(
      { to: user.email, rawToken: issued.token },
      overrides.sender,
      overrides.gateEnvironment,
    );

    await prisma.activationDeliveryAudit.update({
      where: { id: audit.id },
      data:
        result.status === "SENT"
          ? {
              status: "SENT",
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: result.messageId ?? null,
            }
          : {
              status: "FAILED",
              attemptedAt: new Date(),
              errorCode: result.reason ?? "UNKNOWN",
            },
    });

    return { delivered: result.status === "SENT" };
  } catch {
    // Lookup, limiter, issuance, delivery, and audit-write failures are all
    // indistinguishable to the caller — see module doc comment.
    return { delivered: false };
  }
}
