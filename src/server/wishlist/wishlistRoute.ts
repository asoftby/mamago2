import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth/server";

import { WishlistError, wishlistEnabled, wishlistErrorStatus } from "./wishlistPure";

/** Shared auth + flag + error mapping for wishlist author routes. */
export async function withWishlistUser(
  handler: (user: { id: string }) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (!wishlistEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  try {
    return await handler({ id: user.id });
  } catch (error) {
    if (error instanceof WishlistError) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details ?? null },
        { status: wishlistErrorStatus(error.code) },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_input", message: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 },
      );
    }
    // Symbolic only: the raw message can echo user-provided values.
    console.error("[wishlist] unexpected error", error instanceof Error ? error.name : typeof error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new WishlistError("invalid_input", "Некорректный JSON");
  }
}
