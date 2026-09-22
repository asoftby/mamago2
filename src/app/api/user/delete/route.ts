import { NextResponse } from "next/server";
import { handleDeleteOwnAccount } from "@/server/account/deleteAccountRoute";

/** Legacy alias. The deletion policy lives in one canonical handler. */
export async function POST() {
  try {
    return await handleDeleteOwnAccount();
  } catch (error) {
    console.error("[api/user/delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
