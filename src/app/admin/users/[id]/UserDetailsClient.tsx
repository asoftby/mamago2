"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Role, UserStatus, UserModerationActionType } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";
import { UserModerationForm } from "@/components/admin/users/UserModerationForm";
import { ArrowLeft } from "lucide-react";

interface User {
  id: string;
  email: string;
  phoneE164: string | null;
  role: Role;
  status: UserStatus;
  statusReason: string | null;
  suspendedUntil: Date | null;
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Stats {
  businessCount: number;
  placesCount: number;
  activitiesCount: number;
}

interface ModerationAction {
  id: string;
  actionType: UserModerationActionType;
  reason: string;
  note: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: {
    id: string;
    email: string;
    role: Role;
  };
}

interface AuditLog {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actor: {
    id: string;
    email: string;
    role: Role;
  };
}

interface UserDetails {
  user: User;
  stats: Stats;
  moderationHistory: ModerationAction[];
  auditLog: AuditLog[];
}

const STATUS_COLORS: Record<UserStatus, string> = {
  PENDING_ACTIVATION: "bg-sky-100 text-sky-800",
  ACTIVE: "bg-green-100 text-green-800",
  LIMITED: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BANNED: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_ACTIVATION: "Ожидает активации",
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

const ACTION_LABELS: Record<UserModerationActionType, string> = {
  WARN: "Предупреждение",
  LIMIT: "Ограничение",
  SUSPEND: "Приостановка",
  BAN: "Блокировка",
  UNBAN: "Разблокировка",
  ROLE_CHANGE: "Изменение роли",
};

export function UserDetailsClient({ userId }: { userId: string }) {
  const [data, setData] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      
      if (res.status === 401) {
        throw new Error("Необходима авторизация. Войдите как администратор или модератор.");
      }
      
      if (res.status === 403) {
        throw new Error("Недостаточно прав. Требуется роль ADMIN или MODERATOR.");
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch user details");
      }

      const result = await res.json();
      setData(result);
    } catch (err: unknown) {
      console.error("Error fetching user details:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-red-600">
          Ошибка: {error || "Пользователь не найден"}
        </div>
      </div>
    );
  }

  const { user, stats, moderationHistory, auditLog } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="text-gray-600">ID: {user.id}</p>
        </div>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="flex items-center gap-2">
                {user.email}
                {user.emailVerifiedAt && (
                  <span className="text-green-600" title="Подтвержден">✓</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Телефон</div>
              <div className="flex items-center gap-2">
                {user.phoneE164 || <span className="text-gray-400">—</span>}
                {user.phoneVerifiedAt && (
                  <span className="text-green-600" title="Подтвержден">✓</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Роль</div>
              <Badge className={ROLE_COLORS[user.role]}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>

            <div>
              <div className="text-sm text-gray-500">Статус</div>
              <Badge className={STATUS_COLORS[user.status]}>
                {STATUS_LABELS[user.status]}
              </Badge>
            </div>

            {user.statusReason && (
              <div className="col-span-2">
                <div className="text-sm text-gray-500">Причина статуса</div>
                <div>{user.statusReason}</div>
              </div>
            )}

            {user.suspendedUntil && (
              <div className="col-span-2">
                <div className="text-sm text-gray-500">Приостановлен до</div>
                <div>{format(new Date(user.suspendedUntil), "dd.MM.yyyy HH:mm", { locale: ru })}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-gray-500">Последний вход</div>
              <div>
                {user.lastLoginAt
                  ? formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                      locale: ru,
                    })
                  : "Никогда"}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Регистрация</div>
              <div>
                {format(new Date(user.createdAt), "dd.MM.yyyy HH:mm", { locale: ru })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Активность</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">{stats.businessCount}</div>
              <div className="text-sm text-gray-500">Бизнесов</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.placesCount}</div>
              <div className="text-sm text-gray-500">Мест</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activitiesCount}</div>
              <div className="text-sm text-gray-500">Активностей</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moderation Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Действия модерации</CardTitle>
        </CardHeader>
        <CardContent>
          <UserModerationForm userId={userId} currentStatus={user.status} onSuccess={fetchUserDetails} />
        </CardContent>
      </Card>

      {/* Moderation History */}
      <Card>
        <CardHeader>
          <CardTitle>История модерации</CardTitle>
        </CardHeader>
        <CardContent>
          {moderationHistory.length === 0 ? (
            <div className="text-center py-4 text-gray-500">Нет записей</div>
          ) : (
            <div className="space-y-4">
              {moderationHistory.map((action) => (
                <div key={action.id} className="border-l-2 border-gray-200 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{ACTION_LABELS[action.actionType]}</Badge>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(action.createdAt), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Причина: {action.reason}</div>
                    {action.note && <div className="text-gray-600">Заметка: {action.note}</div>}
                    {action.expiresAt && (
                      <div className="text-gray-600">
                        Истекает: {format(new Date(action.expiresAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </div>
                    )}
                    <div className="text-gray-500 mt-1">
                      Модератор: {action.createdBy.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>Журнал аудита</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <div className="text-center py-4 text-gray-500">Нет записей</div>
          ) : (
            <div className="space-y-2">
              {auditLog.map((log) => (
                <div key={log.id} className="flex items-start gap-4 text-sm py-2 border-b last:border-0">
                  <div className="text-gray-500 min-w-[140px]">
                    {format(new Date(log.createdAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{log.action}</div>
                    <div className="text-gray-600">Админ: {log.actor.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
