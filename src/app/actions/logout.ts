"use server";

import { redirect } from "next/navigation";
import { revokeServerAuthSession } from "@/lib/auth/revokeServerAuthSession";
import { buildLogoutSuccessRedirectUrl } from "@/lib/auth/logoutRedirectUrl";

export async function logoutAction() {
  await revokeServerAuthSession();
  redirect(await buildLogoutSuccessRedirectUrl());
}
