import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { countUserSavedIdeas } from "@/server/services/idea.service";

/** Сколько всего идей сохранено у пользователя — для счётчика «Мои идеи · N» в виджете плана. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ count: await countUserSavedIdeas(user.id) });
}
