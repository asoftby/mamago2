import React from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getCurrentUser } from "@/lib/auth/server";
import { getModerationNavCounts } from "@/lib/admin/getModerationNavCounts";
import { getB2bPendingVerificationCount } from "@/lib/admin/getB2bPendingVerificationCount";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

const EMPTY_MODERATION_COUNTS: ModerationNavCounts = {
  queueTotal: 0,
  places: 0,
  events: 0,
  offers: 0,
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto");
  const user = await getCurrentUser();

  // Require authentication for admin
  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login?from=admin",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/me",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  let moderationCounts: ModerationNavCounts = EMPTY_MODERATION_COUNTS;
  let b2bPendingVerificationCount = 0;
  try {
    [moderationCounts, b2bPendingVerificationCount] = await Promise.all([
      getModerationNavCounts(),
      getB2bPendingVerificationCount(),
    ]);
  } catch (e) {
    console.error("admin layout: moderation / b2b counts failed:", e);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Header */}
      <AdminHeader
        userEmail={user.email || undefined}
        moderationCounts={moderationCounts}
        b2bPendingVerificationCount={b2bPendingVerificationCount}
      />

      {/* Two-column layout: Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Hidden on mobile */}
        <div className="hidden lg:block bg-white border-r border-gray-200">
          <AdminSidebar
            moderationCounts={moderationCounts}
            b2bPendingVerificationCount={b2bPendingVerificationCount}
          />
        </div>

        {/* Right Content Area — min-w-0 чтобы flex не раздувал ширину по таблице; скролл остаётся внутри страниц */}
        <main className="min-w-0 flex-1 w-full lg:w-auto">
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
