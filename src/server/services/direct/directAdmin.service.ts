/**
 * Admin/Moderator read layer + moderation action helpers for Direct
 * (Phase 4). Everything here is either:
 *   (a) a read query shaped for the admin operational screens — admin sees
 *       MORE than customer/business (raw hidden message text, senderUserId,
 *       both real identities), which is why this is a separate service
 *       rather than reusing directConversation.service.ts (that one
 *       deliberately redacts for the customer/business DTOs); or
 *   (b) a thin wrapper that iterates DirectThread rows and delegates to the
 *       existing Phase 1 write services (blockThread/unblockThread/
 *       createDirectMessage/completeThread/resolveComplaint) — no new
 *       moderation logic, no new Prisma writes beyond what those already do.
 *
 * "Диалог" here follows the same canon as Phase 3.2: one (businessId,
 * customerUserId) pair. "Повод обращения" is still exactly today's
 * DirectThread — just labeled differently in the admin UI.
 */

import "server-only";
import prisma from "@/lib/prisma";
import {
  DirectActorType,
  DirectComplaintStatus,
  DirectRiskSeverity,
  DirectRiskSignalType,
  DirectThreadStatus,
  type Prisma,
  type PublicationType,
} from "@prisma/client";
import { blockThread, completeThread, unblockThread } from "./directThread.service";
import { createDirectMessage } from "./directMessage.service";
import { deriveRiskLevel, getRepeatedLimitTriggers } from "./directRiskSignal.service";

// ─── Shared publication/business/customer resolution (unredacted) ─────────────

const adminThreadInclude = {
  offer: { select: { title: true, slug: true } },
  activity: { select: { title: true, slug: true } },
  place: { select: { title: true, slug: true } },
  business: { select: { id: true, name: true } },
  customer: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.DirectThreadInclude;

type ThreadWithAdminRelations = Prisma.DirectThreadGetPayload<{ include: typeof adminThreadInclude }>;

function resolvePublicationTitleAndHref(thread: ThreadWithAdminRelations): { title: string; href: string | null } {
  if (thread.place) return { title: thread.place.title, href: thread.place.slug ? `/places/${thread.place.slug}` : null };
  if (thread.offer) return { title: thread.offer.title, href: thread.offer.slug ? `/offers/${thread.offer.slug}` : null };
  if (thread.activity) return { title: thread.activity.title, href: thread.activity.slug ? `/events/${thread.activity.slug}` : null };
  return { title: "Публикация недоступна", href: null };
}

function dialogHref(threadId: string): string {
  return `/admin/communications/direct/dialogs/${threadId}`;
}

// ─── Overview ───────────────────────────────────────────────────────────────

export interface DirectOverviewStats {
  totalDialogs: number;
  activeThreads: number;
  newOccasions24h: number;
  blockedThreads: number;
  pendingComplaints: number;
  hiddenMessages: number;
  messages24h: number;
  businessesWithoutReply: number;
}

export async function getDirectOverviewStats(): Promise<DirectOverviewStats> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    allThreads,
    activeThreads,
    newOccasions24h,
    blockedThreads,
    pendingComplaints,
    hiddenMessages,
    messages24h,
    noReplyGroups,
  ] = await Promise.all([
    prisma.directThread.findMany({ select: { businessId: true, customerUserId: true } }),
    prisma.directThread.count({ where: { status: DirectThreadStatus.OPEN } }),
    prisma.directThread.count({ where: { createdAt: { gte: since24h } } }),
    prisma.directThread.count({ where: { status: DirectThreadStatus.BLOCKED } }),
    prisma.directComplaint.count({ where: { status: DirectComplaintStatus.PENDING } }),
    prisma.directMessage.count({ where: { hiddenAt: { not: null } } }),
    prisma.directMessage.count({ where: { createdAt: { gte: since24h } } }),
    prisma.directThread.findMany({
      where: { status: DirectThreadStatus.OPEN, lastMessageBy: DirectActorType.CUSTOMER },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
  ]);

  const totalDialogs = new Set(allThreads.map((t) => `${t.businessId}:${t.customerUserId}`)).size;

  return {
    totalDialogs,
    activeThreads,
    newOccasions24h,
    blockedThreads,
    pendingComplaints,
    hiddenMessages,
    messages24h,
    businessesWithoutReply: noReplyGroups.length,
  };
}

// ─── Dialogs (one card = businessId + customerUserId pair) ─────────────────

export type AdminDialogFilter =
  | "ALL"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "ARCHIVE"
  | "WITH_COMPLAINTS"
  | "NO_BUSINESS_REPLY";

export interface AdminDialogListItem {
  key: string;
  businessId: string;
  businessName: string;
  customerUserId: string;
  customerName: string;
  latestThreadId: string;
  latestThreadNumber: number;
  latestPublicationTitle: string;
  lastMessageAt: Date;
  lastMessageBy: DirectActorType | null;
  lastMessagePreview: string | null;
  occasionCount: number;
  unreadCount: number;
  hasComplaints: boolean;
  hiddenMessageCount: number;
  status: "ACTIVE" | "BLOCKED" | "COMPLETED" | "ARCHIVE";
}

function deriveAdminDialogStatus(status: DirectThreadStatus): "ACTIVE" | "BLOCKED" | "COMPLETED" | "ARCHIVE" {
  if (status === DirectThreadStatus.BLOCKED) return "BLOCKED";
  if (status === DirectThreadStatus.ARCHIVED) return "ARCHIVE";
  if (status === DirectThreadStatus.CLOSED) return "COMPLETED";
  return "ACTIVE";
}

/** Parses "D-10253" or "10253" into a numeric threadNumber for search. */
function parseThreadNumberQuery(search: string): number | null {
  const digits = search.replace(/^[Dd]-?/, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  return Number.parseInt(digits, 10);
}

export async function getAdminDialogs(
  filter: AdminDialogFilter = "ALL",
  search?: string,
): Promise<AdminDialogListItem[]> {
  const threads = await prisma.directThread.findMany({
    include: {
      ...adminThreadInclude,
      messages: { orderBy: { createdAt: "desc" as const }, take: 1, select: { body: true, hiddenAt: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Cheap platform-wide signals for the WITH_COMPLAINTS / hidden-count
  // columns — simple queries, not joined analytics (per Phase 4 scope).
  const [complaintThreadIds, hiddenMessageRows] = await Promise.all([
    prisma.directComplaint.findMany({ select: { threadId: true } }),
    prisma.directMessage.findMany({ where: { hiddenAt: { not: null } }, select: { threadId: true } }),
  ]);
  const threadsWithComplaints = new Set(complaintThreadIds.map((c) => c.threadId));
  const hiddenCountByThread = new Map<string, number>();
  for (const row of hiddenMessageRows) {
    hiddenCountByThread.set(row.threadId, (hiddenCountByThread.get(row.threadId) ?? 0) + 1);
  }

  const byPair = new Map<string, typeof threads>();
  for (const t of threads) {
    const key = `${t.businessId}:${t.customerUserId}`;
    const group = byPair.get(key);
    if (group) group.push(t);
    else byPair.set(key, [t]);
  }

  const items: AdminDialogListItem[] = [];
  for (const [key, group] of byPair) {
    const latest = group[0]; // threads queried ordered by lastMessageAt desc
    const { title: latestPublicationTitle } = resolvePublicationTitleAndHref(latest);
    const threadIds = group.map((g) => g.id);

    const unreadCount = await prisma.directMessage.count({
      where: { threadId: { in: threadIds }, readAt: null },
    });
    const hiddenMessageCount = threadIds.reduce((sum, id) => sum + (hiddenCountByThread.get(id) ?? 0), 0);
    const hasComplaints = threadIds.some((id) => threadsWithComplaints.has(id));
    const lastMessage = latest.messages[0];

    items.push({
      key,
      businessId: latest.businessId,
      businessName: latest.business.name,
      customerUserId: latest.customerUserId,
      customerName: latest.customer.displayName?.trim() || "Пользователь",
      latestThreadId: latest.id,
      latestThreadNumber: latest.threadNumber,
      latestPublicationTitle,
      lastMessageAt: latest.lastMessageAt,
      lastMessageBy: latest.lastMessageBy,
      lastMessagePreview:
        lastMessage && !lastMessage.hiddenAt ? lastMessage.body : lastMessage ? "Скрыто (см. диалог)" : null,
      occasionCount: group.length,
      unreadCount,
      hasComplaints,
      hiddenMessageCount,
      status: deriveAdminDialogStatus(latest.status),
    });
  }

  let filtered = items;
  switch (filter) {
    case "ACTIVE":
      filtered = items.filter((i) => i.status === "ACTIVE");
      break;
    case "BLOCKED":
      filtered = items.filter((i) => i.status === "BLOCKED");
      break;
    case "COMPLETED":
      filtered = items.filter((i) => i.status === "COMPLETED");
      break;
    case "ARCHIVE":
      filtered = items.filter((i) => i.status === "ARCHIVE");
      break;
    case "WITH_COMPLAINTS":
      filtered = items.filter((i) => i.hasComplaints);
      break;
    case "NO_BUSINESS_REPLY":
      filtered = items.filter((i) => i.status === "ACTIVE" && i.lastMessageBy === DirectActorType.CUSTOMER);
      break;
    default:
      filtered = items;
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const threadNumberQuery = parseThreadNumberQuery(trimmedSearch);
    const needle = trimmedSearch.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        (threadNumberQuery !== null && i.latestThreadNumber === threadNumberQuery) ||
        i.businessName.toLowerCase().includes(needle) ||
        i.customerName.toLowerCase().includes(needle) ||
        i.latestPublicationTitle.toLowerCase().includes(needle),
    );
  }

  return filtered;
}

// ─── Dialog detail (unredacted) ─────────────────────────────────────────────

export interface AdminOccasionDetail {
  threadId: string;
  threadNumber: number;
  publicationType: PublicationType;
  publicationTitle: string;
  publicationHref: string | null;
  status: DirectThreadStatus;
  createdAt: Date;
  completedAt: Date | null;
}

export interface AdminMessageDetail {
  id: string;
  threadId: string;
  senderType: DirectActorType;
  senderUserId: string | null;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  hiddenAt: Date | null;
  hiddenByUserId: string | null;
  hiddenReason: string | null;
}

export interface AdminComplaintDetail {
  id: string;
  threadId: string;
  reason: string;
  comment: string | null;
  status: DirectComplaintStatus;
  resolution: string | null;
  reporterName: string;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface AdminDialogDetail {
  businessId: string;
  businessName: string;
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  occasions: AdminOccasionDetail[];
  messages: AdminMessageDetail[];
  complaints: AdminComplaintDetail[];
  /** Which occasion a new admin action (system message/complete) defaults to. */
  latestOpenThreadId: string | null;
}

export async function getAdminDialogDetail(
  businessId: string,
  customerUserId: string,
): Promise<AdminDialogDetail | null> {
  const threads = await prisma.directThread.findMany({
    where: { businessId, customerUserId },
    include: {
      ...adminThreadInclude,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (threads.length === 0) return null;

  const first = threads[0];
  const threadIds = threads.map((t) => t.id);

  const complaints = await prisma.directComplaint.findMany({
    where: { threadId: { in: threadIds } },
    include: { reporter: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const occasions: AdminOccasionDetail[] = [];
  const messages: AdminMessageDetail[] = [];

  for (const thread of threads) {
    const { title, href } = resolvePublicationTitleAndHref(thread);
    occasions.push({
      threadId: thread.id,
      threadNumber: thread.threadNumber,
      publicationType: thread.publicationType,
      publicationTitle: title,
      publicationHref: href,
      status: thread.status,
      createdAt: thread.createdAt,
      completedAt: thread.completedAt,
    });

    for (const m of thread.messages) {
      messages.push({
        id: m.id,
        threadId: thread.id,
        senderType: m.senderType,
        senderUserId: m.senderUserId,
        body: m.body, // unredacted — admin-only
        createdAt: m.createdAt,
        readAt: m.readAt,
        hiddenAt: m.hiddenAt,
        hiddenByUserId: m.hiddenByUserId,
        hiddenReason: m.hiddenReason,
      });
    }
  }

  const openThreads = threads
    .filter((t) => t.status === DirectThreadStatus.OPEN)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    businessId,
    businessName: first.business.name,
    customerUserId,
    customerName: first.customer.displayName?.trim() || "Пользователь",
    customerEmail: first.customer.email,
    occasions,
    messages,
    complaints: complaints.map((c) => ({
      id: c.id,
      threadId: c.threadId,
      reason: c.reason,
      comment: c.comment,
      status: c.status,
      resolution: c.resolution,
      reporterName: c.reporter.displayName?.trim() || "Пользователь",
      createdAt: c.createdAt,
      reviewedAt: c.reviewedAt,
    })),
    latestOpenThreadId: openThreads[0]?.id ?? null,
  };
}

// ─── Moderation actions (thin wrappers over Phase 1 services) ──────────────

export async function blockDialogForAdmin(params: {
  businessId: string;
  customerUserId: string;
  blockedByUserId: string;
  actorRole: string;
  reason?: string | null;
}): Promise<{ blockedCount: number }> {
  const threads = await prisma.directThread.findMany({
    where: { businessId: params.businessId, customerUserId: params.customerUserId, status: DirectThreadStatus.OPEN },
    select: { id: true },
  });
  for (const t of threads) {
    await blockThread({
      threadId: t.id,
      blockedByUserId: params.blockedByUserId,
      actorRole: params.actorRole,
      reason: params.reason,
    });
  }
  return { blockedCount: threads.length };
}

export async function unblockDialogForAdmin(params: {
  businessId: string;
  customerUserId: string;
  unblockedByUserId: string;
  actorRole: string;
}): Promise<{ unblockedCount: number }> {
  const threads = await prisma.directThread.findMany({
    where: { businessId: params.businessId, customerUserId: params.customerUserId, status: DirectThreadStatus.BLOCKED },
    select: { id: true },
  });
  for (const t of threads) {
    await unblockThread({ threadId: t.id, unblockedByUserId: params.unblockedByUserId, actorRole: params.actorRole });
  }
  return { unblockedCount: threads.length };
}

/** senderType is always SYSTEM here — an admin who wants to converse as themselves already can via the existing reply endpoint (resolveDirectActorType tags them ADMIN automatically). */
export async function sendSystemMessageForAdmin(params: {
  threadId: string;
  body: string;
  sentByUserId: string;
}) {
  return createDirectMessage({
    threadId: params.threadId,
    senderType: DirectActorType.SYSTEM,
    senderUserId: params.sentByUserId,
    body: params.body,
  });
}

export { completeThread as completeOccasionForAdmin };

// ─── Occasions (flat list — "Повод обращения" = today's DirectThread) ─────

export type AdminOccasionFilter = "ALL" | "NEW" | "ACTIVE" | "COMPLETED" | "BLOCKED" | "ARCHIVE";

export interface AdminOccasionListItem extends AdminOccasionDetail {
  businessId: string;
  businessName: string;
  customerUserId: string;
  customerName: string;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  filterBucket: Exclude<AdminOccasionFilter, "ALL">;
}

function deriveOccasionBucket(
  status: DirectThreadStatus,
  hasBusinessReply: boolean,
): Exclude<AdminOccasionFilter, "ALL"> {
  if (status === DirectThreadStatus.BLOCKED) return "BLOCKED";
  if (status === DirectThreadStatus.ARCHIVED) return "ARCHIVE";
  if (status === DirectThreadStatus.CLOSED) return "COMPLETED";
  return hasBusinessReply ? "ACTIVE" : "NEW";
}

export async function getAdminOccasions(
  filter: AdminOccasionFilter = "ALL",
  publicationType?: PublicationType,
  search?: string,
): Promise<AdminOccasionListItem[]> {
  const threads = await prisma.directThread.findMany({
    where: publicationType ? { publicationType } : undefined,
    include: {
      ...adminThreadInclude,
      messages: {
        orderBy: { createdAt: "desc" as const },
        select: { body: true, senderType: true, hiddenAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let items: AdminOccasionListItem[] = threads.map((thread) => {
    const { title, href } = resolvePublicationTitleAndHref(thread);
    const hasBusinessReply = thread.messages.some(
      (m) => m.senderType === DirectActorType.BUSINESS || m.senderType === DirectActorType.ADMIN,
    );
    const lastMessage = thread.messages[0];

    return {
      threadId: thread.id,
      threadNumber: thread.threadNumber,
      publicationType: thread.publicationType,
      publicationTitle: title,
      publicationHref: href,
      status: thread.status,
      createdAt: thread.createdAt,
      completedAt: thread.completedAt,
      businessId: thread.businessId,
      businessName: thread.business.name,
      customerUserId: thread.customerUserId,
      customerName: thread.customer.displayName?.trim() || "Пользователь",
      lastMessageAt: thread.lastMessageAt,
      lastMessagePreview:
        lastMessage && !lastMessage.hiddenAt ? lastMessage.body : lastMessage ? "Скрыто (см. диалог)" : null,
      filterBucket: deriveOccasionBucket(thread.status, hasBusinessReply),
    };
  });

  if (filter !== "ALL") {
    items = items.filter((i) => i.filterBucket === filter);
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const threadNumberQuery = parseThreadNumberQuery(trimmedSearch);
    const needle = trimmedSearch.toLowerCase();
    items = items.filter(
      (i) =>
        (threadNumberQuery !== null && i.threadNumber === threadNumberQuery) ||
        i.businessName.toLowerCase().includes(needle) ||
        i.customerName.toLowerCase().includes(needle) ||
        i.publicationTitle.toLowerCase().includes(needle),
    );
  }

  return items;
}

// ─── Complaints ─────────────────────────────────────────────────────────────

export interface AdminComplaintListItem {
  id: string;
  threadId: string;
  threadNumber: number;
  reason: string;
  comment: string | null;
  status: DirectComplaintStatus;
  resolution: string | null;
  reporterName: string;
  businessId: string;
  businessName: string;
  customerUserId: string;
  customerName: string;
  createdAt: Date;
  reviewedAt: Date | null;
}

export async function getAdminComplaints(status?: DirectComplaintStatus): Promise<AdminComplaintListItem[]> {
  const complaints = await prisma.directComplaint.findMany({
    where: status ? { status } : undefined,
    include: {
      reporter: { select: { displayName: true } },
      thread: {
        select: {
          threadNumber: true,
          businessId: true,
          customerUserId: true,
          business: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return complaints.map((c) => ({
    id: c.id,
    threadId: c.threadId,
    threadNumber: c.thread.threadNumber,
    reason: c.reason,
    comment: c.comment,
    status: c.status,
    resolution: c.resolution,
    reporterName: c.reporter.displayName?.trim() || "Пользователь",
    businessId: c.thread.businessId,
    businessName: c.thread.business.name,
    customerUserId: c.thread.customerUserId,
    customerName: c.thread.customer.displayName?.trim() || "Пользователь",
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt,
  }));
}

// ─── Safety dashboard (Phase 5 Trust & Safety) ─────────────────────────────

const CONTACT_ESCAPE_SIGNAL_TYPES: DirectRiskSignalType[] = [
  DirectRiskSignalType.CONTACT_PHONE,
  DirectRiskSignalType.CONTACT_EMAIL,
  DirectRiskSignalType.CONTACT_LINK,
  DirectRiskSignalType.CONTACT_TELEGRAM,
  DirectRiskSignalType.CONTACT_WHATSAPP,
  DirectRiskSignalType.CONTACT_INSTAGRAM,
];

const FLOOD_NO_REPLY_SIGNAL_TYPES: DirectRiskSignalType[] = [
  DirectRiskSignalType.FLOOD_LOCK_TRIGGERED,
  DirectRiskSignalType.NO_REPLY_CAP_TRIGGERED,
];

const safetySignalInclude = {
  business: { select: { id: true, name: true } },
  customer: { select: { id: true, displayName: true } },
  thread: { select: { threadNumber: true } },
} satisfies Prisma.DirectRiskSignalInclude;

type SignalWithAdminRelations = Prisma.DirectRiskSignalGetPayload<{ include: typeof safetySignalInclude }>;

export interface SafetySignalRow {
  id: string;
  signalType: DirectRiskSignalType;
  severity: DirectRiskSeverity;
  score: number;
  createdAt: Date;
  threadId: string | null;
  threadNumber: number | null;
  messageId: string | null;
  businessId: string | null;
  businessName: string | null;
  customerUserId: string | null;
  customerName: string | null;
  dialogHref: string | null;
}

function toSafetySignalRow(s: SignalWithAdminRelations): SafetySignalRow {
  return {
    id: s.id,
    signalType: s.signalType,
    severity: s.severity,
    score: s.score,
    createdAt: s.createdAt,
    threadId: s.threadId,
    threadNumber: s.thread?.threadNumber ?? null,
    messageId: s.messageId,
    businessId: s.businessId,
    businessName: s.business?.name ?? null,
    customerUserId: s.customerUserId,
    customerName: s.customer?.displayName?.trim() || (s.customerUserId ? "Пользователь" : null),
    dialogHref: s.threadId ? dialogHref(s.threadId) : null,
  };
}

export interface SafetyDialogRisk {
  businessId: string;
  businessName: string;
  customerUserId: string;
  customerName: string;
  threadId: string;
  threadNumber: number;
  score: number;
  level: DirectRiskSeverity;
  dialogHref: string;
}

export interface RepeatedOffenderRow {
  id: string;
  createdAt: Date;
  businessId: string | null;
  businessName: string | null;
  customerUserId: string | null;
  customerName: string | null;
  distinctThreadCount: number | null;
}

export interface SafetyHiddenMessageRow {
  id: string;
  threadId: string;
  threadNumber: number;
  businessName: string;
  customerName: string;
  body: string;
  hiddenReason: string | null;
  hiddenAt: Date;
  dialogHref: string;
}

export interface DirectSafetyDashboard {
  windowDays: number;
  highRiskDialogs: SafetyDialogRisk[];
  recentSignals: SafetySignalRow[];
  contactEscapeMessages: SafetySignalRow[];
  floodNoReplyTriggers: SafetySignalRow[];
  repeatedOffenders: RepeatedOffenderRow[];
  blockedDialogs: AdminDialogListItem[];
  hiddenMessages: SafetyHiddenMessageRow[];
  openComplaints: AdminComplaintListItem[];
}

const SAFETY_LIST_LIMIT = 50;
const HIGH_RISK_DIALOG_LIMIT = 20;

/**
 * Everything here reads from the DirectRiskSignal ledger (written at message
 * send time / hide / block / complaint — see directRiskSignal.service.ts) or
 * from already-bounded Phase 4 admin queries. Nothing here re-scans message
 * bodies live — that detection happens once, at send time.
 */
export async function getDirectSafetyDashboard(windowDays = 7): Promise<DirectSafetyDashboard> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [windowSignals, repeatedOffenderRows, blockedDialogs, hiddenMessageRows, openComplaints] = await Promise.all([
    prisma.directRiskSignal.findMany({
      where: { createdAt: { gte: since } },
      include: safetySignalInclude,
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    getRepeatedLimitTriggers(windowDays),
    getAdminDialogs("BLOCKED"),
    prisma.directMessage.findMany({
      where: { hiddenAt: { not: null }, createdAt: { gte: since } },
      include: { thread: { select: { threadNumber: true, business: { select: { name: true } }, customer: { select: { displayName: true } } } } },
      orderBy: { hiddenAt: "desc" },
      take: SAFETY_LIST_LIMIT,
    }),
    getAdminComplaints(DirectComplaintStatus.PENDING),
  ]);

  const recentSignals = windowSignals.slice(0, SAFETY_LIST_LIMIT).map(toSafetySignalRow);
  const contactEscapeMessages = windowSignals
    .filter((s) => CONTACT_ESCAPE_SIGNAL_TYPES.includes(s.signalType))
    .slice(0, SAFETY_LIST_LIMIT)
    .map(toSafetySignalRow);
  const floodNoReplyTriggers = windowSignals
    .filter((s) => FLOOD_NO_REPLY_SIGNAL_TYPES.includes(s.signalType))
    .slice(0, SAFETY_LIST_LIMIT)
    .map(toSafetySignalRow);

  const repeatedOffenders: RepeatedOffenderRow[] = repeatedOffenderRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    businessId: r.businessId,
    businessName: r.business?.name ?? null,
    customerUserId: r.customerUserId,
    customerName: r.customer?.displayName?.trim() || (r.customerUserId ? "Пользователь" : null),
    distinctThreadCount:
      r.metadata && typeof r.metadata === "object" && "distinctThreadCount" in r.metadata
        ? Number((r.metadata as Record<string, unknown>).distinctThreadCount)
        : null,
  }));

  // Dialog-level score = sum of thread-scoped signals (excludes REPEATED_LIMIT_TRIGGERED,
  // which is actor-level and has no threadId) grouped by (businessId, customerUserId).
  // windowSignals is already ordered createdAt desc, so the first signal seen per key
  // is the latest one — its threadId/threadNumber is what the dialog link should use.
  const byDialog = new Map<string, { businessId: string; businessName: string; customerUserId: string; customerName: string; threadId: string; threadNumber: number; score: number }>();
  for (const s of windowSignals) {
    if (!s.businessId || !s.customerUserId || !s.threadId) continue;
    const key = `${s.businessId}:${s.customerUserId}`;
    const existing = byDialog.get(key);
    if (existing) {
      existing.score += s.score;
    } else {
      byDialog.set(key, {
        businessId: s.businessId,
        businessName: s.business?.name ?? "—",
        customerUserId: s.customerUserId,
        customerName: s.customer?.displayName?.trim() || "Пользователь",
        threadId: s.threadId,
        threadNumber: s.thread?.threadNumber ?? 0,
        score: s.score,
      });
    }
  }
  const highRiskDialogs: SafetyDialogRisk[] = Array.from(byDialog.values())
    .map((d) => ({ ...d, level: deriveRiskLevel(d.score), dialogHref: dialogHref(d.threadId) }))
    .filter((d) => d.level === DirectRiskSeverity.HIGH || d.level === DirectRiskSeverity.CRITICAL)
    .sort((a, b) => b.score - a.score)
    .slice(0, HIGH_RISK_DIALOG_LIMIT);

  const hiddenMessages: SafetyHiddenMessageRow[] = hiddenMessageRows.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    threadNumber: m.thread.threadNumber,
    businessName: m.thread.business.name,
    customerName: m.thread.customer.displayName?.trim() || "Пользователь",
    body: m.body,
    hiddenReason: m.hiddenReason,
    hiddenAt: m.hiddenAt!,
    dialogHref: dialogHref(m.threadId),
  }));

  return {
    windowDays,
    highRiskDialogs,
    recentSignals,
    contactEscapeMessages,
    floodNoReplyTriggers,
    repeatedOffenders,
    blockedDialogs,
    hiddenMessages,
    openComplaints,
  };
}

// ─── Logs (AdminAuditLog filtered to Direct entity types) ──────────────────

const DIRECT_ENTITY_TYPES = [
  "DIRECT_THREAD",
  "DIRECT_MESSAGE",
  "DIRECT_COMPLAINT",
  "DIRECT_RISK_SIGNAL",
  "DIRECT_PLATFORM_SETTINGS",
] as const;
export type DirectAuditEntityTypeFilter = (typeof DIRECT_ENTITY_TYPES)[number] | "ALL";

export interface AdminDirectAuditLogItem {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  metadata: unknown;
  before: unknown;
  after: unknown;
  dialogHref: string | null;
}

export async function getDirectAuditLogsForAdmin(
  entityTypeFilter: DirectAuditEntityTypeFilter = "ALL",
): Promise<AdminDirectAuditLogItem[]> {
  const logs = await prisma.adminAuditLog.findMany({
    where: { entityType: entityTypeFilter === "ALL" ? { in: [...DIRECT_ENTITY_TYPES] } : entityTypeFilter },
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Best-effort resolution of "which thread does this log entry belong to",
  // so the log can link back to a dialog — messages/complaints need one
  // extra lookup each since their entityId isn't a threadId directly.
  const messageIds = logs.filter((l) => l.entityType === "DIRECT_MESSAGE").map((l) => l.entityId);
  const complaintIds = logs.filter((l) => l.entityType === "DIRECT_COMPLAINT").map((l) => l.entityId);
  const riskSignalIds = logs.filter((l) => l.entityType === "DIRECT_RISK_SIGNAL").map((l) => l.entityId);

  const [messages, complaints, riskSignals] = await Promise.all([
    messageIds.length
      ? prisma.directMessage.findMany({ where: { id: { in: messageIds } }, select: { id: true, threadId: true } })
      : Promise.resolve([]),
    complaintIds.length
      ? prisma.directComplaint.findMany({ where: { id: { in: complaintIds } }, select: { id: true, threadId: true } })
      : Promise.resolve([]),
    riskSignalIds.length
      ? prisma.directRiskSignal.findMany({ where: { id: { in: riskSignalIds } }, select: { id: true, threadId: true } })
      : Promise.resolve([]),
  ]);
  const threadIdByMessageId = new Map(messages.map((m) => [m.id, m.threadId]));
  const threadIdByComplaintId = new Map(complaints.map((c) => [c.id, c.threadId]));
  const threadIdByRiskSignalId = new Map(riskSignals.map((r) => [r.id, r.threadId]));

  return logs.map((log) => {
    let threadId: string | null = null;
    if (log.entityType === "DIRECT_THREAD") threadId = log.entityId;
    else if (log.entityType === "DIRECT_MESSAGE") threadId = threadIdByMessageId.get(log.entityId) ?? null;
    else if (log.entityType === "DIRECT_COMPLAINT") threadId = threadIdByComplaintId.get(log.entityId) ?? null;
    else if (log.entityType === "DIRECT_RISK_SIGNAL") threadId = threadIdByRiskSignalId.get(log.entityId) ?? null;

    return {
      id: log.id,
      createdAt: log.createdAt,
      actorId: log.actorId,
      actorName: log.actor?.displayName?.trim() || log.actor?.email || null,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      reason: log.reason,
      metadata: log.metadata,
      before: log.before,
      after: log.after,
      dialogHref: threadId ? dialogHref(threadId) : null,
    };
  });
}
