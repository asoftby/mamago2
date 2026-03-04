import React from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { getCurrentUser } from "@/lib/auth/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="w-60 border-r p-4 flex flex-col">
          <div className="font-semibold text-lg mb-6">mamaGo Admin</div>
          
          <div className="flex-1">
            <AdminNav />
          </div>

          {user ? (
            <AdminUserMenu email={user.email} />
          ) : (
            <div className="border-t pt-4 mt-auto">
              <Link
                href="/login?from=admin"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Войти
              </Link>
            </div>
          )}
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
