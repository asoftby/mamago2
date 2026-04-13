/**
 * Compatibility-only route.
 * Canonical settings surfaces live under `/me/settings`, `/business/settings`, and `/admin/settings`.
 */

import { redirect } from "next/navigation";
import { buildCanonicalSettingsHrefByRoute } from "@/lib/settings/routing";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";

export const metadata = { title: "Каналы уведомлений | mamaGo" };

export default async function UnifiedNotificationSettingsPage() {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  redirect(buildCanonicalSettingsHrefByRoute(context, "notifications"));
}
