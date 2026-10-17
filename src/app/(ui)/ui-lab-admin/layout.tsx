import type { Metadata } from "next";
import { requireUiLabAccess } from "@/lib/ui-lab/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LegacyUiLabLayout({ children }: { children: React.ReactNode }) {
  await requireUiLabAccess();
  return children;
}
