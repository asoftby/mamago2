import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { PageForm } from "../PageForm";

export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900">Создать страницу</h1>
        <p className="text-sm text-gray-600 mt-1">
          Новая юридическая, маркетинговая или системная страница
        </p>
      </div>

      <PageForm mode="create" />
    </div>
  );
}
