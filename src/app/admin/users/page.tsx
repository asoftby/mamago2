import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { UsersListClient } from "./UsersListClient";

export default async function AdminUsersPage() {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Пользователи</h1>
          <p className="text-sm text-gray-600 mt-1">Управление пользователями и модерация</p>
        </div>
      </div>

      {/* AdminPageContent */}
      <UsersListClient />
    </div>
  );
}
