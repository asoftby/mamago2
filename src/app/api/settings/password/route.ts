import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteSessionCookie } from "@/lib/auth/session";
import {
  changePassword,
  changePasswordSchema,
} from "@/server/auth/changePassword.service";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await changePassword({
    userId: user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.changed && result.reason === "PASSWORD_UNAVAILABLE") {
    return NextResponse.json(
      { error: "Для этого аккаунта пароль не задан — смена пароля недоступна" },
      { status: 400 },
    );
  }

  if (!result.changed) {
    return NextResponse.json(
      { error: "Wrong current password" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, reauthRequired: true });
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  deleteSessionCookie(response, host ?? undefined);
  return response;
}
