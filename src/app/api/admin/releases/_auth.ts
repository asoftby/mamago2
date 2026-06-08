import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

export async function requireReleaseAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, error: "Требуется авторизация" },
        { status: 401 },
      ),
    };
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, error: "Доступ запрещён" },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}
