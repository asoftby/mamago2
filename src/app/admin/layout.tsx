import React from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Require authentication for admin
  if (!user) {
    redirect("/login?from=admin");
  }

  // Require ADMIN role
  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Header */}
      <AdminHeader userEmail={user.email || undefined} />

      {/* Two-column layout: Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Hidden on mobile */}
        <div className="hidden lg:block bg-white border-r border-gray-200">
          <AdminSidebar />
        </div>

        {/* Right Content Area */}
        <main className="flex-1 w-full lg:w-auto">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
