import type { Metadata } from "next";
import React from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

export const metadata: Metadata = {
  robots: PERMANENT_NOINDEX_ROBOTS,
};

/**
 * Личный кабинет /me наследует primary sans от root layout.
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin();
  }

  return <div className="min-w-0 antialiased">{children}</div>;
}
