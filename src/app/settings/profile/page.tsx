/**
 * Compatibility-only route.
 * Canonical settings surfaces live under `/me/settings`, `/business/settings`, and `/admin/settings`.
 */

import { redirect } from "next/navigation";
import { buildCanonicalSettingsHrefByRoute } from "@/lib/settings/routing";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";

export const metadata = { title: "Аватар и ник | mamaGo" };

export default async function ProfileSettingsUnifiedPage() {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  redirect(buildCanonicalSettingsHrefByRoute(context, "profile"));
}
