import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canViewUiLab, isUiLabEnabled } from "./accessPolicy";

/** Guard page/layout rendering: rejects prod, unknown environments and anonymous users. */
export async function requireUiLabAccess(): Promise<void> {
  if (!isUiLabEnabled(process.env)) notFound();
  const user = await getCurrentUser();
  if (!canViewUiLab(user?.role)) notFound();
}
