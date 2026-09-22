import { NextResponse } from "next/server";
import { handleDeleteOwnAccount } from "@/server/account/deleteAccountRoute";

export async function POST() {
  try {
    return await handleDeleteOwnAccount();
  } catch (error) {
    console.error("[api/me/delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
