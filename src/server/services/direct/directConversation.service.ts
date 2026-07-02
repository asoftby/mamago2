/**
 * Unified "Мои сообщения" conversation view (Phase 3.2) — one card per
 * counterparty, aggregating multiple existing DirectThread rows, shown
 * identically whether the viewer is acting as a customer or as a business
 * representative.
 *
 * A "conversation" is fully identified by the pair (businessId,
 * customerUserId) — that pair is what groups DirectThread rows together,
 * regardless of who's looking at it:
 *   - Viewing as CUSTOMER: counterparty = the Business (brand/logo).
 *   - Viewing as BUSINESS: counterparty = that Customer (display name/avatar).
 * A user who owns/represents a Business sees BOTH kinds of cards merged
 * into the same list, sorted by lastMessageAt — no separate business inbox.
 *
 * ARCHITECTURAL NOTE / TODO(business-thread-migration):
 * ------------------------------------------------------------------------
 * DirectThread is still exactly what Phase 1 built: one row per
 * (customerUserId, businessId, publication). This file does NOT change
 * that — it is a pure presentation-layer aggregation on top of it, so a
 * customer sees ONE chat per business instead of one card per publication,
 * without any schema migration, without touching createDirectThread(),
 * createDirectMessage(), markThreadRead(), notifications, or audit.
 *
 * Each existing DirectThread becomes an "occasion" (повод обращения) inside
 * the merged conversation — exactly what the current threadNumber (D-10253,
 * D-10458, ...) already represents, just rendered as a header block instead
 * of a separate list card.
 *
 * If this stops being enough (e.g. we need occasions to be independently
 * assignable to different business staff, or a business needs to reply to
 * one occasion without it affecting others' unread state), the real fix is
 * a schema migration along these lines — NOT implemented now:
 *
 *   Business
 *     └─ Conversation   (1 per businessId + customerUserId — new table)
 *          └─ Request   (today's DirectThread, demoted to a child of
 *                         Conversation; keeps publicationType/offerId/
 *                         activityId/placeId, threadNumber, status)
 *               └─ Message  (today's DirectMessage, FK moves from
 *                             threadId → conversationId, keeps a
 *                             requestId to still render occasion headers)
 *
 *   Migration sketch (for a dedicated future phase, NOT this one):
 *     1. Add Conversation table + Conversation.id on DirectThread (nullable
 *        FK, backfillable) instead of dropping/renaming anything.
 *     2. Backfill: group existing DirectThread rows by
 *        (customerUserId, businessId), create one Conversation per group,
 *        set DirectThread.conversationId.
 *     3. Move DirectMessage.threadId reads to join through conversationId
 *        where the UI needs the merged feed; keep threadId for the
 *        "which occasion" tag (no data loss, additive column).
 *     4. Only after both reads and writes are migrated and verified,
 *        consider whether DirectThread should be renamed to
 *        "DirectRequest" — a rename, not a rebuild.
 *   Estimated complexity: MEDIUM (additive migration, backfill script,
 *   no destructive schema changes) — see the Phase 3/3.1/3.2 reports for
 *   the full write-up.
 * ------------------------------------------------------------------------
 */

import "server-only";
import prisma from "@/lib/prisma";
import { DirectActorType, DirectThreadStatus, type Prisma } from "@prisma/client";
import { getBusinessIdsUserCanAccess } from "@/lib/auth/activityAccess";
import {
  resolveDirectBrand,
  threadListInclude,
  type ThreadWithDisplayRelations,
} from "./directCustomerQueries.service";

export type ConversationTab = "ALL" | "ACTIVE" | "WAITING" | "COMPLETED" | "ARCHIVE";
export type ConversationViewerRole = "CUSTOMER" | "BUSINESS";

export interface UnifiedConversationListItem {
  /** Stable card key: businessId (CUSTOMER view) or `${businessId}:${customerUserId}` (BUSINESS view). */
  key: string;
  viewerRole: ConversationViewerRole;
  counterpartyName: string;
  counterpartyLogoUrl: string | null;
  /** Most recently active occasion — list card links to /me/direct/{latestThreadId}. */
  latestThreadId: string;
  /** Searchable fields from the most recent occasion (see the `q` param on GET /api/direct). */
  latestThreadNumber: number;
  latestPublicationTitle: string;
  lastMessageAt: Date;
  lastMessageBy: DirectActorType | null;
  lastMessagePreview: string | null;
  /** Summed across every occasion (DirectThread) with this counterparty. */
  unreadCount: number;
  occasionCount: number;
  tab: Exclude<ConversationTab, "ALL">;
}

/** Conversation-level tab is derived from its most recently active occasion. */
function deriveConversationTab(
  status: DirectThreadStatus,
  lastMessageBy: DirectActorType | null,
): Exclude<ConversationTab, "ALL"> {
  if (status === DirectThreadStatus.ARCHIVED) return "ARCHIVE";
  if (status === DirectThreadStatus.CLOSED) return "COMPLETED";
  if (status === DirectThreadStatus.OPEN && lastMessageBy === DirectActorType.CUSTOMER) return "WAITING";
  return "ACTIVE";
}

const threadIncludeWithCustomer = {
  ...threadListInclude,
  customer: { select: { displayName: true, avatarUrl: true } },
} satisfies Prisma.DirectThreadInclude;

type ThreadWithCustomerRelations = Prisma.DirectThreadGetPayload<{
  include: typeof threadIncludeWithCustomer;
}>;

async function unreadCountFor(threadIds: string[], excludeSenderTypes: DirectActorType[]): Promise<number> {
  if (threadIds.length === 0) return 0;
  return prisma.directMessage.count({
    where: { threadId: { in: threadIds }, senderType: { notIn: excludeSenderTypes }, readAt: null },
  });
}

/** Customer-side groups: this user's own threads, grouped by the business they messaged. */
async function getCustomerSideItems(userId: string): Promise<UnifiedConversationListItem[]> {
  const threads = await prisma.directThread.findMany({
    where: { customerUserId: userId },
    include: threadListInclude,
    orderBy: { lastMessageAt: "desc" },
  });

  const byBusiness = new Map<string, ThreadWithDisplayRelations[]>();
  for (const t of threads) {
    const group = byBusiness.get(t.businessId);
    if (group) group.push(t);
    else byBusiness.set(t.businessId, [t]);
  }

  const items: UnifiedConversationListItem[] = [];
  for (const [businessId, group] of byBusiness) {
    // `threads` was queried ordered by lastMessageAt desc, and we push into
    // each group in that same order, so group[0] is the most recent one.
    const latest = group[0];
    const { brand, publicationTitle } = await resolveDirectBrand(latest);
    const unreadCount = await unreadCountFor(group.map((g) => g.id), [DirectActorType.CUSTOMER]);
    const lastMessage = latest.messages[0];

    items.push({
      key: businessId,
      viewerRole: "CUSTOMER",
      counterpartyName: brand.name,
      counterpartyLogoUrl: brand.logoUrl,
      latestThreadId: latest.id,
      latestThreadNumber: latest.threadNumber,
      latestPublicationTitle: publicationTitle,
      lastMessageAt: latest.lastMessageAt,
      lastMessageBy: latest.lastMessageBy,
      lastMessagePreview:
        lastMessage && !lastMessage.hiddenAt ? lastMessage.body : lastMessage ? "Сообщение скрыто модератором" : null,
      unreadCount,
      occasionCount: group.length,
      tab: deriveConversationTab(latest.status, latest.lastMessageBy),
    });
  }
  return items;
}

/** Business-side groups: every business this user represents, grouped by which customer messaged them. */
async function getBusinessSideItems(userId: string): Promise<UnifiedConversationListItem[]> {
  const businessIds = await getBusinessIdsUserCanAccess(userId);
  if (businessIds.length === 0) return [];

  const threads = await prisma.directThread.findMany({
    where: { businessId: { in: businessIds } },
    include: threadIncludeWithCustomer,
    orderBy: { lastMessageAt: "desc" },
  });

  const byCustomer = new Map<string, ThreadWithCustomerRelations[]>();
  for (const t of threads) {
    const groupKey = `${t.businessId}:${t.customerUserId}`;
    const group = byCustomer.get(groupKey);
    if (group) group.push(t);
    else byCustomer.set(groupKey, [t]);
  }

  const items: UnifiedConversationListItem[] = [];
  for (const [key, group] of byCustomer) {
    const latest = group[0];
    const { publicationTitle } = await resolveDirectBrand(latest);
    const unreadCount = await unreadCountFor(group.map((g) => g.id), [DirectActorType.BUSINESS, DirectActorType.ADMIN]);
    const lastMessage = latest.messages[0];

    items.push({
      key,
      viewerRole: "BUSINESS",
      counterpartyName: latest.customer.displayName?.trim() || "Пользователь",
      counterpartyLogoUrl: latest.customer.avatarUrl ?? null,
      latestThreadId: latest.id,
      latestThreadNumber: latest.threadNumber,
      latestPublicationTitle: publicationTitle,
      lastMessageAt: latest.lastMessageAt,
      lastMessageBy: latest.lastMessageBy,
      lastMessagePreview:
        lastMessage && !lastMessage.hiddenAt ? lastMessage.body : lastMessage ? "Сообщение скрыто модератором" : null,
      unreadCount,
      occasionCount: group.length,
      tab: deriveConversationTab(latest.status, latest.lastMessageBy),
    });
  }
  return items;
}

/** Parses "D-10253" or "10253" into a numeric threadNumber for search. */
function parseThreadNumberQuery(search: string): number | null {
  const digits = search.replace(/^[Dd]-?/, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  return Number.parseInt(digits, 10);
}

/**
 * The single list backing "Мои сообщения" for everyone — a plain user only
 * ever gets CUSTOMER-role items back (getBusinessIdsUserCanAccess returns
 * []), a business owner/member gets both kinds merged by lastMessageAt.
 *
 * `search` matches counterparty name, the most recent occasion's
 * publication title, or its thread number ("D-10253"/"10253") — it does not
 * search older occasions within a conversation, only the latest one shown
 * on the card.
 */
export async function getUnifiedConversationsForUser(
  userId: string,
  tab: ConversationTab = "ALL",
  search?: string,
): Promise<UnifiedConversationListItem[]> {
  const [customerItems, businessItems] = await Promise.all([
    getCustomerSideItems(userId),
    getBusinessSideItems(userId),
  ]);

  let items = [...customerItems, ...businessItems].sort(
    (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
  );

  if (tab !== "ALL") {
    items = items.filter((item) => item.tab === tab);
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const threadNumberQuery = parseThreadNumberQuery(trimmedSearch);
    const needle = trimmedSearch.toLowerCase();
    items = items.filter(
      (item) =>
        (threadNumberQuery !== null && item.latestThreadNumber === threadNumberQuery) ||
        item.counterpartyName.toLowerCase().includes(needle) ||
        item.latestPublicationTitle.toLowerCase().includes(needle),
    );
  }

  return items;
}

export async function getUnifiedConversationCountsForUser(
  userId: string,
): Promise<Record<ConversationTab, number>> {
  const all = await getUnifiedConversationsForUser(userId, "ALL");
  const counts: Record<ConversationTab, number> = {
    ALL: all.length,
    ACTIVE: 0,
    WAITING: 0,
    COMPLETED: 0,
    ARCHIVE: 0,
  };
  for (const item of all) counts[item.tab] += 1;
  return counts;
}

export interface ConversationOccasion {
  threadId: string;
  threadNumber: number;
  publicationType: Prisma.DirectThreadGetPayload<object>["publicationType"];
  publicationTitle: string;
  publicationHref: string | null;
  status: DirectThreadStatus;
  createdAt: Date;
  /** Purely decorative — mirrors the "🎉 Повод обращения" example. */
  emoji: string;
}

export interface ConversationMessage {
  id: string;
  threadId: string;
  senderType: DirectActorType;
  body: string;
  createdAt: Date;
  hidden: boolean;
}

export interface UnifiedConversationDetail {
  businessId: string;
  customerUserId: string;
  viewerRole: ConversationViewerRole;
  counterpartyName: string;
  counterpartyLogoUrl: string | null;
  /** Sorted oldest-first — render as header blocks in the merged feed. */
  occasions: ConversationOccasion[];
  /** All messages from every occasion, merged and sorted oldest-first. */
  messages: ConversationMessage[];
  /** Which underlying DirectThread a new message should attach to; null if none is writable. */
  replyTargetThreadId: string | null;
  canWrite: boolean;
}

function emojiForPublicationType(type: Prisma.DirectThreadGetPayload<object>["publicationType"]): string {
  if (type === "PLACE") return "📍";
  if (type === "OFFER") return "🎉";
  return "📅"; // EVENT
}

/**
 * Given a thread the caller has already been authorized on (see
 * requireDirectThreadAccess), decides whether they're looking at it as the
 * customer or as the business — a plain "is this user the customer, else do
 * they represent this business" check. Returns null if neither (caller
 * should already have 403'd before this is reached in practice).
 */
export async function resolveViewerRoleForThread(
  userId: string,
  thread: { customerUserId: string; businessId: string },
): Promise<{ viewerRole: ConversationViewerRole; businessId: string; customerUserId: string } | null> {
  if (thread.customerUserId === userId) {
    return { viewerRole: "CUSTOMER", businessId: thread.businessId, customerUserId: thread.customerUserId };
  }
  const myBusinessIds = await getBusinessIdsUserCanAccess(userId);
  if (myBusinessIds.includes(thread.businessId)) {
    return { viewerRole: "BUSINESS", businessId: thread.businessId, customerUserId: thread.customerUserId };
  }
  return null;
}

/**
 * Merged, multi-occasion view for one (business, customer) pair — the same
 * data regardless of which side is asking; only counterpartyName/logoUrl
 * and viewerRole flip. Does NOT perform authorization — callers must resolve
 * (and confirm) the viewer role via resolveViewerRoleForThread() first.
 */
export async function getUnifiedConversationDetail(
  businessId: string,
  customerUserId: string,
  viewerRole: ConversationViewerRole,
): Promise<UnifiedConversationDetail | null> {
  const threads = await prisma.directThread.findMany({
    where: { businessId, customerUserId },
    include: {
      ...threadIncludeWithCustomer,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (threads.length === 0) return null;

  const first = threads[0];
  let counterpartyName: string;
  let counterpartyLogoUrl: string | null;
  if (viewerRole === "CUSTOMER") {
    const { brand } = await resolveDirectBrand(first);
    counterpartyName = brand.name;
    counterpartyLogoUrl = brand.logoUrl;
  } else {
    counterpartyName = first.customer.displayName?.trim() || "Пользователь";
    counterpartyLogoUrl = first.customer.avatarUrl ?? null;
  }

  const occasions: ConversationOccasion[] = [];
  const messages: ConversationMessage[] = [];

  for (const thread of threads) {
    const { publicationTitle, publicationHref } = await resolveDirectBrand(thread);
    occasions.push({
      threadId: thread.id,
      threadNumber: thread.threadNumber,
      publicationType: thread.publicationType,
      publicationTitle,
      publicationHref,
      status: thread.status,
      createdAt: thread.createdAt,
      emoji: emojiForPublicationType(thread.publicationType),
    });

    for (const m of thread.messages) {
      messages.push({
        id: m.id,
        threadId: thread.id,
        senderType: m.senderType,
        body: m.hiddenAt ? "Сообщение скрыто модератором" : m.body,
        createdAt: m.createdAt,
        hidden: Boolean(m.hiddenAt),
      });
    }
  }

  messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Reply target: most recently created occasion that's still OPEN. An
  // older occasion can be OPEN while a newer one got BLOCKED/ARCHIVED —
  // in that case the older one is still a valid place to keep talking.
  const writable = threads
    .filter((t) => t.status === DirectThreadStatus.OPEN)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const replyTargetThreadId = writable[0]?.id ?? null;

  return {
    businessId,
    customerUserId,
    viewerRole,
    counterpartyName,
    counterpartyLogoUrl,
    occasions,
    messages,
    replyTargetThreadId,
    canWrite: replyTargetThreadId !== null,
  };
}
