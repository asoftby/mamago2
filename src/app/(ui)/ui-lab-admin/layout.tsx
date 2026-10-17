import type { Metadata } from "next";
import { requireUiLabAccess } from "@/lib/ui-lab/access";
import { UiLabAccessDenied } from "@/components/ui-lab/UiLabAccessDenied";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LegacyUiLabLayout({ children }: { children: React.ReactNode }) {
  const hasAccess = await requireUiLabAccess();
  if (!hasAccess) return <UiLabAccessDenied />;
  return children;
}
