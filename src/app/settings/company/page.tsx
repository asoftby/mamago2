/**
 * Compatibility-only route.
 * Canonical business settings surface lives under `/business/settings`.
 */

import { redirect } from "next/navigation";
import { buildCanonicalSettingsHrefByRoute } from "@/lib/settings/routing";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";

export const metadata = { title: "Компания | mamaGo" };

export default async function CompanySettingsPage() {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  redirect(buildCanonicalSettingsHrefByRoute(context, "company"));
}
