import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getUserCollections, getUserIdeas } from "@/server/ideas/loadUserIdeas";

export const dynamic = "force-dynamic";

/** Идеи + коллекции + принадлежность — те же данные, что у страницы /me/ideas, для экрана «Мои идеи» в виджете плана. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [ideas, { collections, memberships }] = await Promise.all([
      getUserIdeas(user.id),
      getUserCollections(user.id),
    ]);
    return NextResponse.json({ ideas, collections, memberships }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Load my ideas error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
