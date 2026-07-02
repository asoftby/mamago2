/**
 * Trust & Safety (Phase 5) — risk signal ledger, scoring, and send-time limits
 * for Direct. Everything here is additive on top of Direct Core:
 *  - detectDirectRiskSignals() / recordDirectRiskSignal() only ever INSERT
 *    DirectRiskSignal rows; nothing here edits or hides a DirectMessage.
 *  - checkDirectSendLimits() only ever throws before a message is persisted —
 *    it never mutates DirectThread/DirectMessage itself (blockThread etc.
 *    stay the only place that flips DirectThread.status).
 *  - Scoring is lazy/on-read (sum of DirectRiskSignal.score for a thread),
 *    never a maintained running total, so there is nothing to keep in sync.
 *
 * One phone number or link is NEVER enough to hide a message or block a
 * thread automatically — these are signals for admin review only.
 */

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DirectActorType, DirectRiskSeverity, DirectRiskSignalType } from "@prisma/client";
import { DIRECT_AUDIT_ENTITY, DirectAuditAction, writeDirectAudit } from "./directAudit";
import { getDirectPlatformSettings } from "./directPlatformSettings.service";

export class DirectSendLimitError extends Error {
  constructor(
    message: string,
    public readonly kind: "FLOOD_LOCK" | "NO_REPLY_CAP",
  ) {
    super(message);
    this.name = "DirectSendLimitError";
  }
}

// ─── Scoring table ──────────────────────────────────────────────────────────

const SIGNAL_SCORE: Record<DirectRiskSignalType, number> = {
  CONTACT_PHONE: 10,
  CONTACT_EMAIL: 8,
  CONTACT_LINK: 8,
  CONTACT_TELEGRAM: 15,
  CONTACT_WHATSAPP: 15,
  CONTACT_INSTAGRAM: 12,
  COMPLAINT_OPENED: 25,
  MESSAGE_HIDDEN: 20,
  THREAD_BLOCKED: 40,
  FLOOD_LOCK_TRIGGERED: 25,
  NO_REPLY_CAP_TRIGGERED: 20,
  REPEATED_LIMIT_TRIGGERED: 30,
};

/**
 * Severity is a judgment call layered on top of the score table (not given
 * verbatim in the spec) — escalates roughly with how confirmed/serious the
 * underlying event is: a single contact-escape mention is LOW/MEDIUM noise,
 * a confirmed block or a cross-thread repeat offender is CRITICAL.
 */
const SIGNAL_SEVERITY: Record<DirectRiskSignalType, DirectRiskSeverity> = {
  CONTACT_PHONE: DirectRiskSeverity.LOW,
  CONTACT_EMAIL: DirectRiskSeverity.LOW,
  CONTACT_LINK: DirectRiskSeverity.LOW,
  CONTACT_TELEGRAM: DirectRiskSeverity.MEDIUM,
  CONTACT_WHATSAPP: DirectRiskSeverity.MEDIUM,
  CONTACT_INSTAGRAM: DirectRiskSeverity.MEDIUM,
  COMPLAINT_OPENED: DirectRiskSeverity.HIGH,
  MESSAGE_HIDDEN: DirectRiskSeverity.MEDIUM,
  THREAD_BLOCKED: DirectRiskSeverity.CRITICAL,
  FLOOD_LOCK_TRIGGERED: DirectRiskSeverity.HIGH,
  NO_REPLY_CAP_TRIGGERED: DirectRiskSeverity.MEDIUM,
  REPEATED_LIMIT_TRIGGERED: DirectRiskSeverity.CRITICAL,
};

export function deriveRiskLevel(score: number): DirectRiskSeverity {
  if (score >= 81) return DirectRiskSeverity.CRITICAL;
  if (score >= 51) return DirectRiskSeverity.HIGH;
  if (score >= 21) return DirectRiskSeverity.MEDIUM;
  return DirectRiskSeverity.LOW;
}

// ─── Signal creation (ledger insert + audit) ────────────────────────────────

export interface RecordDirectRiskSignalParams {
  threadId?: string | null;
  messageId?: string | null;
  businessId?: string | null;
  customerUserId?: string | null;
  signalType: DirectRiskSignalType;
  auditAction: DirectAuditAction;
  metadata?: Prisma.InputJsonValue | null;
}

/** Single write path for every DirectRiskSignal row — always pairs the insert with an AdminAuditLog entry. */
export async function recordDirectRiskSignal(params: RecordDirectRiskSignalParams) {
  const score = SIGNAL_SCORE[params.signalType];
  const severity = SIGNAL_SEVERITY[params.signalType];

  const signal = await prisma.directRiskSignal.create({
    data: {
      threadId: params.threadId ?? null,
      messageId: params.messageId ?? null,
      businessId: params.businessId ?? null,
      customerUserId: params.customerUserId ?? null,
      signalType: params.signalType,
      severity,
      score,
      metadata: params.metadata ?? undefined,
    },
  });

  await writeDirectAudit({
    action: params.auditAction,
    entityType: DIRECT_AUDIT_ENTITY.RISK_SIGNAL,
    entityId: signal.id,
    actorId: null,
    actorRole: "SYSTEM",
    metadata: {
      signalType: params.signalType,
      score,
      messageId: params.messageId ?? null,
      threadId: params.threadId ?? null,
      businessId: params.businessId ?? null,
      customerUserId: params.customerUserId ?? null,
    },
  });

  return signal;
}

// ─── Contact-escape detection ───────────────────────────────────────────────

const CONTACT_PATTERNS: Record<
  Extract<
    DirectRiskSignalType,
    "CONTACT_PHONE" | "CONTACT_EMAIL" | "CONTACT_LINK" | "CONTACT_TELEGRAM" | "CONTACT_WHATSAPP" | "CONTACT_INSTAGRAM"
  >,
  RegExp
> = {
  CONTACT_PHONE: /(\+?\d[\d\s\-().]{6,}\d)/,
  CONTACT_EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  CONTACT_LINK: /https?:\/\/\S+/i,
  CONTACT_TELEGRAM: /\b(t\.me\/|telegram|тг\b|телеграм)/i,
  CONTACT_WHATSAPP: /whatsapp|ватсап|вотсап/i,
  CONTACT_INSTAGRAM: /instagram|инстаграм|инста\b/i,
};

/**
 * Pure text scan — no DB access, no side effects. Returns the distinct
 * contact-escape signal types found in the body, restricted to `enabledTypes`
 * when given (Phase 6: admin can turn individual detectors off/on).
 */
export function detectDirectRiskSignals(
  messageBody: string,
  enabledTypes?: ReadonlySet<DirectRiskSignalType>,
): DirectRiskSignalType[] {
  const matched: DirectRiskSignalType[] = [];
  for (const [signalType, pattern] of Object.entries(CONTACT_PATTERNS) as Array<
    [keyof typeof CONTACT_PATTERNS, RegExp]
  >) {
    if (enabledTypes && !enabledTypes.has(signalType)) continue;
    if (pattern.test(messageBody)) matched.push(signalType);
  }
  return matched;
}

/**
 * Runs detection on a just-created message and records one DirectRiskSignal
 * per matched pattern. Never hides the message or blocks the thread — purely
 * additive telemetry for the admin Безопасность screen. Which detectors run
 * is read from DirectPlatformSettings (Phase 6) instead of always-on.
 */
export async function detectAndRecordContactEscapeSignals(params: {
  messageId: string;
  threadId: string;
  businessId: string;
  customerUserId: string;
  body: string;
}): Promise<void> {
  const settings = await getDirectPlatformSettings();
  const enabledTypes = new Set<DirectRiskSignalType>();
  if (settings.contactDetectPhone) enabledTypes.add(DirectRiskSignalType.CONTACT_PHONE);
  if (settings.contactDetectEmail) enabledTypes.add(DirectRiskSignalType.CONTACT_EMAIL);
  if (settings.contactDetectLink) enabledTypes.add(DirectRiskSignalType.CONTACT_LINK);
  if (settings.contactDetectTelegram) enabledTypes.add(DirectRiskSignalType.CONTACT_TELEGRAM);
  if (settings.contactDetectWhatsapp) enabledTypes.add(DirectRiskSignalType.CONTACT_WHATSAPP);
  if (settings.contactDetectInstagram) enabledTypes.add(DirectRiskSignalType.CONTACT_INSTAGRAM);

  const matched = detectDirectRiskSignals(params.body, enabledTypes);
  for (const signalType of matched) {
    await recordDirectRiskSignal({
      threadId: params.threadId,
      messageId: params.messageId,
      businessId: params.businessId,
      customerUserId: params.customerUserId,
      signalType,
      auditAction: DirectAuditAction.RISK_SIGNAL_CREATED,
    });
  }
}

// ─── Flood protection + no-reply cap ────────────────────────────────────────

// Repeated-limit window/threshold aren't part of the Phase 6 settings surface
// (only flood count/interval/lock and no-reply cap count are) — left as-is.
const NO_REPLY_SCAN_WINDOW = 20;
const REPEATED_LIMIT_WINDOW_MS = 24 * 60 * 60_000;
const REPEATED_LIMIT_THRESHOLD = 3;

async function checkFloodLock(params: {
  threadId: string;
  businessId: string;
  customerUserId: string;
  senderType: typeof DirectActorType.CUSTOMER | typeof DirectActorType.BUSINESS;
  floodMessageCount: number;
  floodIntervalSeconds: number;
  floodLockMinutes: number;
}): Promise<void> {
  const lastMessages = await prisma.directMessage.findMany({
    where: { threadId: params.threadId },
    orderBy: { createdAt: "desc" },
    take: params.floodMessageCount,
    select: { senderType: true, createdAt: true },
  });

  if (lastMessages.length < params.floodMessageCount) return;
  if (!lastMessages.every((m) => m.senderType === params.senderType)) return;

  const maxGapMs = params.floodIntervalSeconds * 1000;
  const chronological = [...lastMessages].reverse();
  for (let i = 1; i < chronological.length; i++) {
    const gap = chronological[i].createdAt.getTime() - chronological[i - 1].createdAt.getTime();
    if (gap >= maxGapMs) return; // not a tight burst — no lock
  }

  const lockDurationMs = params.floodLockMinutes * 60_000;
  const mostRecentAt = lastMessages[0].createdAt.getTime();
  const lockUntil = mostRecentAt + lockDurationMs;
  if (Date.now() >= lockUntil) return; // burst happened, but the cooldown already elapsed

  await recordDirectRiskSignal({
    threadId: params.threadId,
    businessId: params.businessId,
    customerUserId: params.customerUserId,
    signalType: DirectRiskSignalType.FLOOD_LOCK_TRIGGERED,
    auditAction: DirectAuditAction.FLOOD_LOCK_TRIGGERED,
    metadata: { senderType: params.senderType, lockUntil: new Date(lockUntil).toISOString() },
  });
  await checkAndRecordRepeatedLimitTrigger({
    businessId: params.senderType === DirectActorType.BUSINESS ? params.businessId : null,
    customerUserId: params.senderType === DirectActorType.CUSTOMER ? params.customerUserId : null,
  });

  throw new DirectSendLimitError("Слишком много сообщений подряд. Попробуйте позже.", "FLOOD_LOCK");
}

async function checkNoReplyCap(params: {
  threadId: string;
  businessId: string;
  customerUserId: string;
  noReplyCapCount: number;
}): Promise<void> {
  const history = await prisma.directMessage.findMany({
    where: { threadId: params.threadId },
    orderBy: { createdAt: "desc" },
    take: NO_REPLY_SCAN_WINDOW,
    select: { senderType: true },
  });

  let consecutiveBusiness = 0;
  for (const m of history) {
    if (m.senderType === DirectActorType.CUSTOMER) break;
    // SYSTEM/ADMIN messages don't count toward the streak but also don't reset it.
    if (m.senderType === DirectActorType.BUSINESS) consecutiveBusiness++;
  }

  if (consecutiveBusiness < params.noReplyCapCount) return;

  await recordDirectRiskSignal({
    threadId: params.threadId,
    businessId: params.businessId,
    customerUserId: params.customerUserId,
    signalType: DirectRiskSignalType.NO_REPLY_CAP_TRIGGERED,
    auditAction: DirectAuditAction.NO_REPLY_CAP_TRIGGERED,
    metadata: { consecutiveBusinessMessages: consecutiveBusiness },
  });
  await checkAndRecordRepeatedLimitTrigger({ businessId: params.businessId, customerUserId: null });

  throw new DirectSendLimitError(
    "Дождитесь ответа пользователя перед следующими сообщениями.",
    "NO_REPLY_CAP",
  );
}

async function checkAndRecordRepeatedLimitTrigger(params: {
  businessId: string | null;
  customerUserId: string | null;
}): Promise<void> {
  const since = new Date(Date.now() - REPEATED_LIMIT_WINDOW_MS);
  const actorWhere = params.businessId ? { businessId: params.businessId } : { customerUserId: params.customerUserId };

  const [triggerRows, alreadyFlagged] = await Promise.all([
    prisma.directRiskSignal.findMany({
      where: {
        ...actorWhere,
        signalType: { in: [DirectRiskSignalType.FLOOD_LOCK_TRIGGERED, DirectRiskSignalType.NO_REPLY_CAP_TRIGGERED] },
        createdAt: { gte: since },
      },
      select: { threadId: true },
    }),
    prisma.directRiskSignal.count({
      where: {
        ...actorWhere,
        signalType: DirectRiskSignalType.REPEATED_LIMIT_TRIGGERED,
        createdAt: { gte: since },
      },
    }),
  ]);

  if (alreadyFlagged > 0) return; // already flagged as a repeated offender in the last 24h — don't spam more signals

  const distinctThreads = new Set(triggerRows.map((r) => r.threadId).filter(Boolean));
  if (distinctThreads.size < REPEATED_LIMIT_THRESHOLD) return;

  await recordDirectRiskSignal({
    threadId: null,
    businessId: params.businessId,
    customerUserId: params.customerUserId,
    signalType: DirectRiskSignalType.REPEATED_LIMIT_TRIGGERED,
    auditAction: DirectAuditAction.REPEATED_LIMIT_TRIGGERED,
    metadata: { distinctThreadCount: distinctThreads.size, windowHours: 24 },
  });
}

/**
 * Called at send time, before a message is persisted. Only CUSTOMER/BUSINESS
 * are subject to limits — SYSTEM/ADMIN sends always pass through. Thresholds
 * (message count/interval/lock minutes/no-reply cap) come from
 * DirectPlatformSettings (Phase 6) instead of hardcoded constants.
 */
export async function checkDirectSendLimits(params: {
  threadId: string;
  businessId: string;
  customerUserId: string;
  senderType: DirectActorType;
}): Promise<void> {
  if (params.senderType !== DirectActorType.CUSTOMER && params.senderType !== DirectActorType.BUSINESS) {
    return;
  }

  const settings = await getDirectPlatformSettings();

  await checkFloodLock({
    threadId: params.threadId,
    businessId: params.businessId,
    customerUserId: params.customerUserId,
    senderType: params.senderType,
    floodMessageCount: settings.floodMessageCount,
    floodIntervalSeconds: settings.floodIntervalSeconds,
    floodLockMinutes: settings.floodLockMinutes,
  });

  if (params.senderType === DirectActorType.BUSINESS) {
    await checkNoReplyCap({
      threadId: params.threadId,
      businessId: params.businessId,
      customerUserId: params.customerUserId,
      noReplyCapCount: settings.noReplyCapCount,
    });
  }
}

// ─── Thread risk summary (lazy on-read scoring) ─────────────────────────────

export interface ThreadRiskSummary {
  score: number;
  level: DirectRiskSeverity;
  signals: Array<{
    id: string;
    signalType: DirectRiskSignalType;
    severity: DirectRiskSeverity;
    score: number;
    metadata: unknown;
    messageId: string | null;
    createdAt: Date;
  }>;
}

export async function getThreadRiskSummary(threadId: string): Promise<ThreadRiskSummary> {
  const signals = await prisma.directRiskSignal.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const score = signals.reduce((sum, s) => sum + s.score, 0);
  return {
    score,
    level: deriveRiskLevel(score),
    signals: signals.map((s) => ({
      id: s.id,
      signalType: s.signalType,
      severity: s.severity,
      score: s.score,
      metadata: s.metadata,
      messageId: s.messageId,
      createdAt: s.createdAt,
    })),
  };
}

/**
 * Same shape as ThreadRiskSummary but summed across every occasion-thread of
 * a dialog (businessId, customerUserId) — the admin dialog screen shows one
 * safety panel per dialog, not per occasion.
 */
export async function getDialogRiskSummary(threadIds: string[]): Promise<ThreadRiskSummary> {
  if (threadIds.length === 0) return { score: 0, level: deriveRiskLevel(0), signals: [] };

  const signals = await prisma.directRiskSignal.findMany({
    where: { threadId: { in: threadIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const score = signals.reduce((sum, s) => sum + s.score, 0);
  return {
    score,
    level: deriveRiskLevel(score),
    signals: signals.map((s) => ({
      id: s.id,
      signalType: s.signalType,
      severity: s.severity,
      score: s.score,
      metadata: s.metadata,
      messageId: s.messageId,
      createdAt: s.createdAt,
    })),
  };
}

export async function getRepeatedLimitTriggers(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  return prisma.directRiskSignal.findMany({
    where: { signalType: DirectRiskSignalType.REPEATED_LIMIT_TRIGGERED, createdAt: { gte: since } },
    include: {
      business: { select: { id: true, name: true } },
      customer: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
