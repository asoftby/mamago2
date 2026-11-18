/**
 * Customer view groups a family's messages by Business for convenience.
 * Business view is deliberately scoped to individual DirectThread (occasion)
 * and must never aggregate multiple bookings into a customer dossier.
 * No schema or underlying Direct/Booking source of truth is duplicated.
 */

import "server-only";
import prisma from "@/lib/prisma";
import { canBusinessWriteDirect, directBookingLifecycleSelect } from "./directBusinessWritePolicy";
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
  /** Customer view uses businessId; business view uses a single DirectThread id. */
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

/** Business-side list: each individual occasion in an authorized Business, never grouped by customer. */
async function getBusinessSideItems(userId: string, selectedBusinessId?: string): Promise<UnifiedConversationListItem[]> {
  const permittedBusinessIds = await getBusinessIdsUserCanAccess(userId);
  if (selectedBusinessId && !permittedBusinessIds.includes(selectedBusinessId)) return [];
  const businessIds = selectedBusinessId ? [selectedBusinessId] : permittedBusinessIds;
  if (businessIds.length === 0) return [];

  // One row per occasion/booking: do not group by customerUserId, and do not
  // select customer profile/avatar or build an implicit business customer CRM.
  const threads = await prisma.directThread.findMany({
    where: { businessId: { in: businessIds } },
    // Only the title is needed for the business request list. Do not fetch
    // customer profiles, place images, logo metadata or MediaAsset fallbacks.
    include: {
      offer: { select: { title: true } },
      activity: { select: { title: true } },
      place: { select: { title: true } },
      messages: threadListInclude.messages,
      bookingRequest: {
        select: directBookingLifecycleSelect,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // One grouped query for unread counts across the full inbox; per-thread
  // queries would become N+1 as soon as one customer has multiple requests.
  const unreadRows = threads.length
    ? await prisma.directMessage.groupBy({
        by: ["threadId"],
        where: {
          threadId: { in: threads.map((thread) => thread.id) },
          senderType: { notIn: [DirectActorType.BUSINESS, DirectActorType.ADMIN] },
          readAt: null,
        },
        _count: { _all: true },
      })
    : [];
  const unreadByThread = new Map(unreadRows.map((row) => [row.threadId, row._count._all]));
  const lastCustomerRows = threads.length
    ? await prisma.directMessage.groupBy({
        by: ["threadId"],
        where: { threadId: { in: threads.map((t) => t.id) }, senderType: DirectActorType.CUSTOMER },
        _max: { createdAt: true },
      })
    : [];
  const lastCustomerByThread = new Map(lastCustomerRows.map((row) => [row.threadId, row._max.createdAt]));
  const now = new Date();

  const items: UnifiedConversationListItem[] = [];
  for (const thread of threads) {
    const publicationTitle = thread.place?.title ?? thread.offer?.title ?? thread.activity?.title ?? "Публикация недоступна";
    const unreadCount = unreadByThread.get(thread.id) ?? 0;
    const lastMessage = thread.messages[0];
    const canWrite = canBusinessWriteDirect({
      threadStatus: thread.status,
      threadBusinessId: thread.businessId,
      threadCustomerUserId: thread.customerUserId,
      bookingRequestId: thread.bookingRequestId,
      booking: thread.bookingRequest,
      latestCustomerMessageAt: lastCustomerByThread.get(thread.id) ?? null,
      now,
    });
    items.push({
      key: thread.id,
      viewerRole: "BUSINESS",
      counterpartyName: `Обращение D-${thread.threadNumber}`,
      counterpartyLogoUrl: null,
      latestThreadId: thread.id,
      latestThreadNumber: thread.threadNumber,
      latestPublicationTitle: publicationTitle,
      lastMessageAt: thread.lastMessageAt,
      lastMessageBy: thread.lastMessageBy,
      lastMessagePreview:
        lastMessage && !lastMessage.hiddenAt ? lastMessage.body : lastMessage ? "Сообщение скрыто модератором" : null,
      unreadCount,
      occasionCount: 1,
      tab: canWrite
        ? deriveConversationTab(thread.status, thread.lastMessageBy)
        : thread.status === DirectThreadStatus.ARCHIVED ? "ARCHIVE" : "COMPLETED",
    });
  }
  return items;
}

/** Personal-profile inbox: only conversations where this user is the customer.
 * Business replies are available via getBusinessConversationsForUser instead.
 */
export async function getCustomerConversationsForUser(
  userId: string,
): Promise<UnifiedConversationListItem[]> {
  return getCustomerSideItems(userId);
}

/** Single counter contract for both personal and business inboxes. */
export function countConversationsByTab(
  items: UnifiedConversationListItem[],
): Record<ConversationTab, number> {
  const counts: Record<ConversationTab, number> = {
    ALL: items.length,
    ACTIVE: 0,
    WAITING: 0,
    COMPLETED: 0,
    ARCHIVE: 0,
  };
  for (const item of items) counts[item.tab] += 1;
  return counts;
}

/** Business inbox: individual owned requests, never a unified per-customer dossier. */
export async function getBusinessConversationsForUser(
  userId: string,
  businessId: string,
): Promise<UnifiedConversationListItem[]> {
  return getBusinessSideItems(userId, businessId);
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

function isViewerOwnMessage(viewerRole: ConversationViewerRole, senderType: DirectActorType): boolean {
  return viewerRole === "BUSINESS"
    ? senderType === DirectActorType.BUSINESS || senderType === DirectActorType.ADMIN
    : senderType === DirectActorType.CUSTOMER;
}

export interface ConversationMessage {
  id: string;
  threadId: string;
  senderType: DirectActorType;
  body: string;
  createdAt: Date;
  hidden: boolean;
  /**
   * Read receipt for the VIEWER'S OWN messages only (null for the other side's
   * and SYSTEM messages) — the counterparty's read state is never disclosed
   * beyond what the sender needs to see.
   */
  readAt: Date | null;
}

export interface UnifiedConversationDetail {
  businessId: string;
  /** BUSINESS responses must not disclose a stable cross-booking customer identifier. */
  customerUserId: string | null;
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
 * Customer sees a unified (business, customer) conversation. Business must
 * supply an authorized scopedThreadId and sees only that single occasion.
 * Caller must authorize the selected DirectThread before calling this method.
 */
export async function getUnifiedConversationDetail(
  businessId: string,
  customerUserId: string,
  viewerRole: ConversationViewerRole,
  scopedThreadId?: string,
): Promise<UnifiedConversationDetail | null> {
  if (viewerRole === "BUSINESS" && !scopedThreadId) return null;
  const threads = await prisma.directThread.findMany({
    where: viewerRole === "BUSINESS"
      ? { id: scopedThreadId, businessId, customerUserId }
      : { businessId, customerUserId },
    include: {
      ...threadIncludeWithCustomer,
      messages: { orderBy: { createdAt: "asc" } },
      bookingRequest: { select: directBookingLifecycleSelect },
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
    // Business sees the specific request, not a persistent identifiable profile.
    counterpartyName = `Обращение D-${first.threadNumber}`;
    counterpartyLogoUrl = null;
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
        readAt: isViewerOwnMessage(viewerRole, m.senderType) ? m.readAt : null,
      });
    }
  }

  messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Reply target: most recently created occasion that's still OPEN. An
  // older occasion can be OPEN while a newer one got BLOCKED/ARCHIVED —
  // in that case the older one is still a valid place to keep talking.
  const now = new Date();
  const writable = threads
    .filter((t) => t.status === DirectThreadStatus.OPEN)
    .filter((t) => viewerRole !== "BUSINESS" || canBusinessWriteDirect({
      threadStatus: t.status,
      threadBusinessId: t.businessId,
      threadCustomerUserId: t.customerUserId,
      bookingRequestId: t.bookingRequestId,
      booking: t.bookingRequest,
      latestCustomerMessageAt: t.messages.filter((m) => m.senderType === DirectActorType.CUSTOMER).at(-1)?.createdAt ?? null,
      now,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const replyTargetThreadId = writable[0]?.id ?? null;

  return {
    businessId,
    customerUserId: viewerRole === "BUSINESS" ? null : customerUserId,
    viewerRole,
    counterpartyName,
    counterpartyLogoUrl,
    occasions,
    messages,
    replyTargetThreadId,
    canWrite: replyTargetThreadId !== null,
  };
}
