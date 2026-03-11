import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { UsersListClient } from "./UsersListClient";

export default async function AdminUsersPage() {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-gray-600 mt-1">Управление пользователями и модерация</p>
      </div>

      <UsersListClient />
    </div>
  );
}
