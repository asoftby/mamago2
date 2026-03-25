import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";

/**
 * Показ владельцу при operationalStatus ≠ ACTIVE (DISABLED / ARCHIVED; без удаления данных).
 */
export default async function BusinessSuspendedPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role === "USER") {
    redirect("/me");
  }
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    redirect("/admin");
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    redirect("/business/onboarding");
  }

  if (business.operationalStatus === "ACTIVE") {
    redirect("/business/dashboard");
  }

  const isArchived = business.operationalStatus === "ARCHIVED";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          {isArchived ? "Бизнес в архиве" : "Бизнес временно отключён"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          {isArchived
            ? "Бизнес выведен из активной работы и не отображается пользователям. Данные сохранены; после восстановления доступа кабинет снова откроется."
            : "Администратор отключил отображение вашего бизнеса для пользователей сайта. Данные сохранены; после восстановления доступа кабинет снова станет доступен."}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Если это ошибка, обратитесь в поддержку.
        </p>
        <form action="/api/auth/logout" method="POST" className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            Выйти из аккаунта
          </button>
        </form>
      </div>
    </div>
  );
}
