import React from "react";
import type { Metadata } from "next";
import { requireUiLabAccess } from "@/lib/ui-lab/access";
import { UiLabAccessDenied } from "@/components/ui-lab/UiLabAccessDenied";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** One protected DEV-only entrypoint shared by catalog, cards, wizard and previews. */
export default async function UiLabLayout({ children }: { children: React.ReactNode }) {
  const hasAccess = await requireUiLabAccess();
  if (!hasAccess) return <UiLabAccessDenied />;

  return <div className="min-h-screen bg-background">{children}</div>;
}
