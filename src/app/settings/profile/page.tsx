/**
 * Compatibility-only route.
 * Canonical settings surfaces live under `/me/settings`, `/business/settings`, and `/admin/settings`.
 * Regular users edit their profile inline on `/me`.
 */

import { redirect } from "next/navigation";
import { buildCanonicalSettingsHrefByRoute, resolveCanonicalSettingsScope } from "@/lib/settings/routing";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";

export const metadata = { title: "Аватар и ник | mamaGo" };

export default async function ProfileSettingsUnifiedPage() {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  if (resolveCanonicalSettingsScope(context, "profile") === "USER") {
    redirect("/me");
  }
  redirect(buildCanonicalSettingsHrefByRoute(context, "profile"));
}
