import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { canViewUiLab, isUiLabEnabled } from "./accessPolicy";

/**
 * A missing session must lead to sign-in, not an indistinguishable 404.
 * In production / unknown environments we still fail closed with 404.
 * Users with the wrong role never receive the lab's component tree.
 */
export async function requireUiLabAccess(): Promise<boolean> {
  if (!isUiLabEnabled(process.env)) notFound();

  const user = await getCurrentUser();
  if (!user) return redirectToLogin();

  return canViewUiLab(user.role);
}
