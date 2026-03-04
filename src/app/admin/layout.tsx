import React from "react";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="w-60 border-r p-4 space-y-6">
          <div className="font-semibold text-lg">mamaGo Admin</div>
          <AdminNav />
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
