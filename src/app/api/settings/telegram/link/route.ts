import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createTelegramLink } from "@/server/services/telegramLink.service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[telegram:link] Unauthorized request");
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:link] Creating link for userId=%s", user.id);
    }

    const result = await createTelegramLink({ userId: user.id });
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:link] Link created successfully for userId=%s", user.id);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось подготовить подключение Telegram";

    console.error("[telegram:link] ERROR:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
