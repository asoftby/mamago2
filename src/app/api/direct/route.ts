import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getUnifiedConversationCountsForUser,
  getUnifiedConversationsForUser,
  type ConversationTab,
} from "@/server/services/direct/directConversation.service";

const VALID_TABS: ConversationTab[] = ["ALL", "ACTIVE", "WAITING", "COMPLETED", "ARCHIVE"];

/**
 * The single "Мои сообщения" list for everyone (Phase 3.2) — one card per
 * counterparty, merging conversations where this user is the customer with
 * conversations where they represent a Business, sorted by lastMessageAt.
 * No separate business inbox endpoint anymore — see
 * directConversation.service.ts for the aggregation.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const tabParam = request.nextUrl.searchParams.get("tab") ?? "ALL";
  const tab = VALID_TABS.includes(tabParam as ConversationTab) ? (tabParam as ConversationTab) : "ALL";
  const search = request.nextUrl.searchParams.get("q") ?? undefined;

  const [conversations, counts] = await Promise.all([
    getUnifiedConversationsForUser(user.id, tab, search),
    getUnifiedConversationCountsForUser(user.id),
  ]);

  return NextResponse.json({ conversations, counts });
}
