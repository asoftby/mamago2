import React from "react";
import type { Metadata } from "next";
import { requireUiLabAccess } from "@/lib/ui-lab/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** One protected DEV-only entrypoint shared by catalog, cards, wizard and previews. */
export default async function UiLabLayout({ children }: { children: React.ReactNode }) {
  await requireUiLabAccess();
  return <div className="min-h-screen bg-background">{children}</div>;
}
