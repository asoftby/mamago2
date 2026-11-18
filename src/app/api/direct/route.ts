import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countConversationsByTab,
  getCustomerConversationsForUser,
  type ConversationTab,
} from "@/server/services/direct/directConversation.service";

const VALID_TABS: ConversationTab[] = ["ALL", "ACTIVE", "WAITING", "COMPLETED", "ARCHIVE"];

/** Personal inbox API: no business-role messages mixed into /me data. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const tabParam = request.nextUrl.searchParams.get("tab") ?? "ALL";
  const tab = VALID_TABS.includes(tabParam as ConversationTab) ? (tabParam as ConversationTab) : "ALL";
  const search = request.nextUrl.searchParams.get("q") ?? undefined;

  const all = await getCustomerConversationsForUser(user.id);
  const counts = countConversationsByTab(all);
  const needle = search?.trim().toLowerCase();
  const conversations = all.filter((item) =>
    (tab === "ALL" || item.tab === tab) &&
    (!needle || item.counterpartyName.toLowerCase().includes(needle) ||
      item.latestPublicationTitle.toLowerCase().includes(needle) ||
      String(item.latestThreadNumber) === needle.replace(/^d-?/i, "")),
  );

  return NextResponse.json({ conversations, counts }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
