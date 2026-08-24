import type { Metadata } from "next";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

export const metadata: Metadata = {
  robots: PERMANENT_NOINDEX_ROBOTS,
};

/**
 * Business root layout - simple passthrough
 * Auth guards are handled in (protected) route group
 * Onboarding route is unguarded
 */
export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
