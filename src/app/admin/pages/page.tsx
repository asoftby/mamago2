import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { AdminPagesClient } from "./AdminPagesClient";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPagesPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Страницы</h1>
          <p className="text-sm text-gray-600 mt-1">
            Юридические, маркетинговые и системные страницы сайта
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Загрузка...</div>}>
        <AdminPagesClient />
      </Suspense>
    </div>
  );
}
