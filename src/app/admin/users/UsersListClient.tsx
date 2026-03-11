"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Role, UserStatus } from "@/types/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface User {
  id: string;
  email: string;
  phoneE164: string | null;
  role: Role;
  status: UserStatus;
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  LIMITED: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BANNED: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Активен",
  LIMITED: "Ограничен",
  SUSPENDED: "Приостановлен",
  BANNED: "Заблокирован",
};

const ROLE_COLORS: Record<Role, string> = {
  USER: "bg-gray-100 text-gray-800",
  BUSINESS_OWNER: "bg-blue-100 text-blue-800",
  MODERATOR: "bg-purple-100 text-purple-800",
  ADMIN: "bg-red-100 text-red-800",
};

const ROLE_LABELS: Record<Role, string> = {
  USER: "Пользователь",
  BUSINESS_OWNER: "Бизнес",
  MODERATOR: "Модератор",
  ADMIN: "Админ",
};

export function UsersListClient() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [query, roleFilter, statusFilter, page]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: "20",
      });

      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      console.log("Fetching users with params:", params.toString());
      const res = await fetch(`/api/admin/users?${params}`);
      console.log("Response status:", res.status);
      
      if (res.status === 401) {
        throw new Error("Необходима авторизация. Войдите как администратор или модератор.");
      }
      
      if (res.status === 403) {
        throw new Error("Недостаточно прав. Требуется роль ADMIN или MODERATOR.");
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch users");
      }

      const result = await res.json();
      console.log("API Response:", result);
      console.log("Users count:", result.users?.length);
      console.log("Data structure:", {
        hasUsers: !!result.users,
        usersIsArray: Array.isArray(result.users),
        usersLength: result.users?.length,
        total: result.total,
      });
      setData(result);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Поиск по email или телефону..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-md"
        />

        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Роль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            <SelectItem value="USER">Пользователь</SelectItem>
            <SelectItem value="BUSINESS_OWNER">Бизнес</SelectItem>
            <SelectItem value="MODERATOR">Модератор</SelectItem>
            <SelectItem value="ADMIN">Админ</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="ACTIVE">Активен</SelectItem>
            <SelectItem value="LIMITED">Ограничен</SelectItem>
            <SelectItem value="SUSPENDED">Приостановлен</SelectItem>
            <SelectItem value="BANNED">Заблокирован</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : !data || data.users.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Пользователи не найдены</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Последний вход</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Регистрация</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {user.email}
                        {user.emailVerifiedAt && (
                          <span className="text-green-600" title="Email подтвержден">✓</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.phoneE164 ? (
                        <div className="flex items-center gap-2">
                          {user.phoneE164}
                          {user.phoneVerifiedAt && (
                            <span className="text-green-600" title="Телефон подтвержден">✓</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={ROLE_COLORS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={STATUS_COLORS[user.status]}>
                        {STATUS_LABELS[user.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.lastLoginAt
                        ? formatDistanceToNow(new Date(user.lastLoginAt), {
                            addSuffix: true,
                            locale: ru,
                          })
                        : "Никогда"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDistanceToNow(new Date(user.createdAt), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm">
                          Открыть
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Показано {data.users.length} из {data.total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </Button>
                <div className="flex items-center gap-2 px-3">
                  Страница {page} из {data.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Вперед
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
