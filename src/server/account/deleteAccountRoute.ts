import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteSessionCookieAction } from "@/lib/auth/session";
import { deleteAccount } from "./deleteAccount.service";

export async function handleDeleteOwnAccount(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await deleteAccount(user.id);
  if (!result.ok) {
    if (result.code === "BUSINESS_OWNER_TRANSFER_REQUIRED") {
      return NextResponse.json(
        { error: "Перед удалением аккаунта передайте владение бизнесом. Обратитесь в поддержку.", code: result.code },
        { status: 409 },
      );
    }
    if (result.code === "LAST_ADMIN") {
      return NextResponse.json(
        { error: "Последний активный администратор не может удалить свой аккаунт.", code: result.code },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await deleteSessionCookieAction();
  return NextResponse.json({ success: true });
}
