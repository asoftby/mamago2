import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isDeferredPublicFeatureEnabled } from "@/lib/config/publicReleaseScope";

export const dynamic = "force-dynamic";

export default function ReleaseScopeLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isDeferredPublicFeatureEnabled("birthdayBuilder")) {
    notFound();
  }

  return children;
}
