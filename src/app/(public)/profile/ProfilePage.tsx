"use client";

import { User, Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Settings, Users, BarChart3 } from "lucide-react";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

interface ProfilePageProps {
  user: User;
  businessStatus?: "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "NEEDS_INFO" | null;
}

export function ProfilePage({ user, businessStatus }: ProfilePageProps) {
  const router = useRouter();

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case "USER":
        return "Пользователь";
      case "BUSINESS_OWNER":
        return "Владелец бизнеса";
      case "ADMIN":
        return "Администратор";
      case "MODERATOR":
        return "Модератор";
      default:
        return role;
    }
  };

  const getBusinessStatusLabel = (status: string | null) => {
    switch (status) {
      case "DRAFT":
        return "Черновик";
      case "PENDING":
        return "На проверке";
      case "REJECTED":
        return "Отклонено";
      case "APPROVED":
        return "Одобрено";
      case "NEEDS_INFO":
        return "Требует дополнения";
      default:
        return "Не определен";
    }
  };

  const getBusinessStatusVariant = (status: string | null) => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "PENDING":
        return "secondary";
      case "REJECTED":
        return "destructive";
      case "NEEDS_INFO":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Профиль</h1>
          <p className="text-muted-foreground mt-2">
            Управляйте своим аккаунтом и настройками
          </p>
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Информация об аккаунте</CardTitle>
            <CardDescription>
              Основные данные вашего аккаунта
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Роль
                </label>
                <p className="text-sm">
                  <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                </p>
              </div>
              {user.phoneE164 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Телефон
                  </label>
                  <p className="text-sm">{user.phoneE164}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Дата регистрации
                </label>
                <p className="text-sm">
                  {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role-specific Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Regular User Actions */}
          {user.role === "USER" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Семейный кабинет
                </CardTitle>
                <CardDescription>
                  Управляйте планами и детьми
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigateToSurface(router, {
                        targetSurface: "public",
                        targetPath: "/me",
                      })
                    }
                  >
                    Перейти в семейный кабинет
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business Owner Actions */}
          {user.role === "BUSINESS_OWNER" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Бизнес-кабинет
                </CardTitle>
                <CardDescription>
                  Управляйте местами и событиями
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {businessStatus && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Статус верификации
                      </label>
                      <div className="mt-1">
                        <Badge variant={getBusinessStatusVariant(businessStatus)}>
                          {getBusinessStatusLabel(businessStatus)}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigateToSurface(router, {
                        targetSurface: "business",
                        targetPath: "/",
                      })
                    }
                  >
                    Перейти в бизнес-кабинет
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Actions */}
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Панель администратора
                </CardTitle>
                <CardDescription>
                  Управление платформой и модерация
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigateToSurface(router, {
                        targetSurface: "admin",
                        targetPath: "/",
                      })
                    }
                  >
                    Перейти в админ-панель
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings Card - Always visible */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Настройки
              </CardTitle>
              <CardDescription>
                Настройки аккаунта и безопасность
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" asChild className="w-full">
                  <Link href="/account">Настройки аккаунта</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/forgot-password">Сменить пароль</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Быстрая навигация</CardTitle>
            <CardDescription>
              Популярные разделы платформы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="ghost" asChild className="h-auto p-4 flex-col">
                <Link href="/minsk">
                  <span className="text-sm font-medium">Минск</span>
                  <span className="text-xs text-muted-foreground">Главная</span>
                </Link>
              </Button>
              <Button variant="ghost" asChild className="h-auto p-4 flex-col">
                <Link href="/minsk/places">
                  <span className="text-sm font-medium">Места</span>
                  <span className="text-xs text-muted-foreground">Каталог</span>
                </Link>
              </Button>
              <Button variant="ghost" asChild className="h-auto p-4 flex-col">
                <Link href="/minsk/events">
                  <span className="text-sm font-medium">События</span>
                  <span className="text-xs text-muted-foreground">Афиша</span>
                </Link>
              </Button>
              <Button variant="ghost" asChild className="h-auto p-4 flex-col">
                <Link href="/minsk/offers">
                  <span className="text-sm font-medium">Предложения</span>
                  <span className="text-xs text-muted-foreground">Скидки</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
