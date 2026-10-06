"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role, UserStatus, UserModerationActionType } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";
import { UserModerationForm } from "@/components/admin/users/UserModerationForm";
import { ArrowLeft, ChevronRight } from "lucide-react";

type ContentStatus =
  | "DRAFT"
  | "PENDING"
  | "PUBLISHED"
  | "NEEDS_REVISION"
  | "REJECTED"
  | "DELETED"
  | "PENDING_UPDATE"
  | "SCHEDULED"
  | "ARCHIVED";

type OfferStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";
type BusinessVerificationStatus =
  | "DRAFT"
  | "PENDING"
  | "NEEDS_INFO"
  | "APPROVED"
  | "REJECTED";
type BusinessOperationalStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";
type BusinessMembershipRole = "OWNER" | "MANAGER";

interface User {
  id: string;
  email: string;
  phoneE164: string | null;
  displayName: string | null;
  telegramConnected: boolean;
  telegramUsername: string | null;
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

interface BusinessAccess {
  membershipRole: BusinessMembershipRole | null;
  membershipActive: boolean;
  relation: "MEMBER" | "OWNER_WITHOUT_MEMBERSHIP" | "NONE";
  business: {
    id: string;
    name: string;
    legalName: string | null;
    verificationStatus: BusinessVerificationStatus;
    operationalStatus: BusinessOperationalStatus;
  } | null;
}

interface BusinessRelation {
  id: string;
  name: string;
  legalName: string | null;
  verificationStatus: BusinessVerificationStatus;
  operationalStatus: BusinessOperationalStatus;
  createdAt: Date;
  updatedAt: Date;
  membershipRole: BusinessMembershipRole;
  membershipActive: boolean;
  memberTitle: string | null;
  relation: "OWNER" | "MEMBER" | "OWNER_WITHOUT_MEMBERSHIP";
}

interface PlaceSummary {
  id: string;
  title: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  createdByUserId: string;
  ownerBusinessId: string | null;
  city: { name: string } | null;
  ownerBusiness: {
    id: string;
    name: string;
    legalName: string | null;
  } | null;
}

interface EventSummary {
  id: string;
  title: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  place: { title: string } | null;
  business: {
    id: string;
    name: string;
    legalName: string | null;
  } | null;
}

interface OfferSummary {
  id: string;
  title: string;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  place: {
    id: string;
    title: string;
    ownerBusiness: {
      id: string;
      name: string;
      legalName: string | null;
    } | null;
  } | null;
}

interface ArticleSummary {
  id: string;
  title: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface RecentAction {
  id: string;
  kind: "LOGIN" | "EVENT" | "ARTICLE" | "BOOKING" | "DIRECT" | "BUSINESS";
  title: string;
  detail: string;
  href: string | null;
  at: Date;
}

interface UserOverview {
  businesses: BusinessRelation[];
  places: {
    total: number;
    items: PlaceSummary[];
  };
  publications: {
    events: { total: number; items: EventSummary[] };
    offers: { total: number; items: OfferSummary[] };
    articles: { total: number; items: ArticleSummary[] };
  };
  customerActivity: {
    planItems: number;
    bookings: number;
    directThreads: number;
    complaints: number;
  };
  recentActions: RecentAction[];
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
  businessAccess: BusinessAccess;
  overview: UserOverview;
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

const BUSINESS_MEMBERSHIP_LABELS: Record<BusinessMembershipRole, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
};

const BUSINESS_VERIFICATION_LABELS: Record<BusinessVerificationStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  NEEDS_INFO: "Нужны данные",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
};

const BUSINESS_OPERATIONAL_LABELS: Record<BusinessOperationalStatus, string> = {
  ACTIVE: "Активен",
  DISABLED: "Отключён",
  ARCHIVED: "Архив",
};

const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  NEEDS_REVISION: "Нужны правки",
  REJECTED: "Отклонено",
  DELETED: "Удалено",
  PENDING_UPDATE: "Правки на модерации",
  SCHEDULED: "Запланировано",
  ARCHIVED: "Архив",
};

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

const ACTION_LABELS: Record<UserModerationActionType, string> = {
  WARN: "Предупреждение",
  LIMIT: "Ограничение",
  SUSPEND: "Приостановка",
  BAN: "Блокировка",
  UNBAN: "Разблокировка",
  ROLE_CHANGE: "Изменение роли",
};

function statusBadgeClass(status: string): string {
  if (status === "PUBLISHED" || status === "APPROVED" || status === "ACTIVE") {
    return "bg-green-100 text-green-800";
  }
  if (status === "REJECTED" || status === "DELETED" || status === "DISABLED") {
    return "bg-red-100 text-red-800";
  }
  if (status === "PENDING" || status === "NEEDS_INFO" || status === "NEEDS_REVISION") {
    return "bg-yellow-100 text-yellow-800";
  }
  return "bg-gray-100 text-gray-800";
}

function formatAgo(value: Date | string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ru });
}

function CountTile({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-700">{label}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="py-4 text-sm text-gray-500">{children}</div>;
}

function RowLink({
  href,
  title,
  subtitle,
  trailing,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-3 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-gray-900">{title}</div>
        {subtitle ? <div className="mt-1 truncate text-xs text-gray-500">{subtitle}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </div>
    </Link>
  );
}

export function UserDetailsClient({ userId }: { userId: string }) {
  const [data, setData] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchUserDetails();
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
      <div className="p-4 sm:p-6">
        <div className="py-8 text-center text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
        <div className="py-8 text-center text-red-600">
          Ошибка: {error || "Пользователь не найден"}
        </div>
      </div>
    );
  }

  const { user, businessAccess, overview, moderationHistory, auditLog } = data;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">
            {user.displayName || "Пользователь"}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Профиль и доступ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-gray-500">ID пользователя</div>
              <div className="break-all font-mono text-sm text-gray-700">{user.id}</div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="flex items-center gap-2 break-all">
                {user.email}
                {user.emailVerifiedAt ? (
                  <span className="text-green-600" title="Подтвержден">✓</span>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Телефон</div>
              <div className="flex items-center gap-2">
                {user.phoneE164 || <span className="text-gray-400">—</span>}
                {user.phoneVerifiedAt ? (
                  <span className="text-green-600" title="Подтвержден">✓</span>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Telegram</div>
              <div>
                {user.telegramConnected
                  ? user.telegramUsername
                    ? `@${user.telegramUsername}`
                    : "Подключён"
                  : <span className="text-gray-400">Не подключён</span>}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Роль платформы</div>
              <Badge className={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
            </div>

            <div>
              <div className="text-sm text-gray-500">Статус аккаунта</div>
              <Badge className={STATUS_COLORS[user.status]}>{STATUS_LABELS[user.status]}</Badge>
            </div>

            <div>
              <div className="text-sm text-gray-500">Бизнес-доступ</div>
              {businessAccess.membershipActive && businessAccess.membershipRole ? (
                <Badge className="bg-blue-100 text-blue-800">
                  {BUSINESS_MEMBERSHIP_LABELS[businessAccess.membershipRole]}
                </Badge>
              ) : businessAccess.relation === "OWNER_WITHOUT_MEMBERSHIP" ? (
                <Badge className="bg-red-100 text-red-800">Требует восстановления</Badge>
              ) : (
                <span className="text-gray-400">Нет</span>
              )}
            </div>

            <div>
              <div className="text-sm text-gray-500">Бизнес-профиль</div>
              {businessAccess.business ? (
                <Link
                  href={`/admin/b2b/partners/${businessAccess.business.id}`}
                  className="font-medium hover:underline"
                >
                  {businessAccess.business.legalName || businessAccess.business.name}
                </Link>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>

            {businessAccess.business ? (
              <>
                <div>
                  <div className="text-sm text-gray-500">Верификация бизнеса</div>
                  <Badge className={statusBadgeClass(businessAccess.business.verificationStatus)}>
                    {BUSINESS_VERIFICATION_LABELS[businessAccess.business.verificationStatus]}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Статус бизнеса</div>
                  <Badge className={statusBadgeClass(businessAccess.business.operationalStatus)}>
                    {BUSINESS_OPERATIONAL_LABELS[businessAccess.business.operationalStatus]}
                  </Badge>
                </div>
              </>
            ) : null}

            {user.statusReason ? (
              <div className="md:col-span-2">
                <div className="text-sm text-gray-500">Причина статуса</div>
                <div>{user.statusReason}</div>
              </div>
            ) : null}

            {user.suspendedUntil ? (
              <div className="md:col-span-2">
                <div className="text-sm text-gray-500">Приостановлен до</div>
                <div>{format(new Date(user.suspendedUntil), "dd.MM.yyyy HH:mm", { locale: ru })}</div>
              </div>
            ) : null}

            <div>
              <div className="text-sm text-gray-500">Последний вход</div>
              <div>{user.lastLoginAt ? formatAgo(user.lastLoginAt) : "Никогда"}</div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Регистрация</div>
              <div>{format(new Date(user.createdAt), "dd.MM.yyyy HH:mm", { locale: ru })}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Связи и контент</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <CountTile value={overview.businesses.length} label="Бизнесы" />
            <CountTile value={overview.places.total} label="Места" />
            <CountTile value={overview.publications.events.total} label="События" />
            <CountTile value={overview.publications.offers.total} label="Офферы бизнеса" />
            <CountTile value={overview.publications.articles.total} label="Статьи" />
            <CountTile value={overview.customerActivity.planItems} label="В плане" />
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Старый показатель «Активности» заменён на отдельные сущности. События считаются по автору,
            офферы — по бизнесам пользователя.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Бизнесы и роли</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.businesses.length === 0 ? (
            <EmptyState>Пользователь не связан с бизнесами.</EmptyState>
          ) : (
            overview.businesses.map((business) => (
              <RowLink
                key={business.id}
                href={`/admin/b2b/partners/${business.id}`}
                title={business.legalName || business.name}
                subtitle={[
                  business.relation === "OWNER_WITHOUT_MEMBERSHIP"
                    ? "Владелец без активного BusinessMember"
                    : BUSINESS_MEMBERSHIP_LABELS[business.membershipRole],
                  business.memberTitle,
                  BUSINESS_VERIFICATION_LABELS[business.verificationStatus],
                  BUSINESS_OPERATIONAL_LABELS[business.operationalStatus],
                ].filter(Boolean).join(" · ")}
                trailing={
                  !business.membershipActive ? (
                    <Badge className="bg-red-100 text-red-800">Нет активного доступа</Badge>
                  ) : null
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Места</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.places.items.length === 0 ? (
            <EmptyState>Связанных мест нет.</EmptyState>
          ) : (
            overview.places.items.map((place) => {
              const relations = [
                place.createdByUserId === user.id ? "Создал" : null,
                place.ownerBusiness
                  ? `Принадлежит: ${place.ownerBusiness.legalName || place.ownerBusiness.name}`
                  : null,
                place.city?.name ?? null,
              ].filter(Boolean).join(" · ");

              return (
                <RowLink
                  key={place.id}
                  href={`/admin/content/places/${place.id}`}
                  title={place.title}
                  subtitle={relations}
                  trailing={
                    <Badge className={statusBadgeClass(place.archivedAt ? "ARCHIVED" : place.status)}>
                      {place.archivedAt ? "Архив" : CONTENT_STATUS_LABELS[place.status]}
                    </Badge>
                  }
                />
              );
            })
          )}
          {overview.places.total > overview.places.items.length ? (
            <div className="text-xs text-gray-500">
              Показаны последние {overview.places.items.length} из {overview.places.total}.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Публикации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">События</h3>
              <span className="text-sm text-gray-500">{overview.publications.events.total}</span>
            </div>
            <div className="space-y-2">
              {overview.publications.events.items.length === 0 ? (
                <EmptyState>Событий нет.</EmptyState>
              ) : (
                overview.publications.events.items.map((event) => (
                  <RowLink
                    key={event.id}
                    href={`/editor/event/${event.id}/edit?returnTo=${encodeURIComponent(
                      `/admin/users/${user.id}`,
                    )}`}
                    title={event.title}
                    subtitle={[
                      event.place?.title,
                      event.business?.legalName || event.business?.name,
                      formatAgo(event.updatedAt),
                    ].filter(Boolean).join(" · ")}
                    trailing={
                      <Badge className={statusBadgeClass(event.status)}>
                        {CONTENT_STATUS_LABELS[event.status]}
                      </Badge>
                    }
                  />
                ))
              )}
            </div>
            {overview.publications.events.total > overview.publications.events.items.length ? (
              <div className="mt-2 text-xs text-gray-500">
                Показаны последние {overview.publications.events.items.length} из {overview.publications.events.total}.
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Офферы бизнеса</h3>
              <span className="text-sm text-gray-500">{overview.publications.offers.total}</span>
            </div>
            <div className="space-y-2">
              {overview.publications.offers.items.length === 0 ? (
                <EmptyState>Офферов нет.</EmptyState>
              ) : (
                overview.publications.offers.items.map((offer) => (
                  <RowLink
                    key={offer.id}
                    href={`/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent(
                      `/admin/users/${user.id}`,
                    )}`}
                    title={offer.title}
                    subtitle={[
                      offer.place?.title,
                      offer.place?.ownerBusiness?.legalName || offer.place?.ownerBusiness?.name,
                      formatAgo(offer.updatedAt),
                    ].filter(Boolean).join(" · ")}
                    trailing={
                      <Badge className={statusBadgeClass(offer.archivedAt ? "ARCHIVED" : offer.status)}>
                        {offer.archivedAt ? "Архив" : OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                    }
                  />
                ))
              )}
            </div>
            {overview.publications.offers.total > overview.publications.offers.items.length ? (
              <div className="mt-2 text-xs text-gray-500">
                Показаны последние {overview.publications.offers.items.length} из {overview.publications.offers.total}.
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Статьи</h3>
              <span className="text-sm text-gray-500">{overview.publications.articles.total}</span>
            </div>
            <div className="space-y-2">
              {overview.publications.articles.items.length === 0 ? (
                <EmptyState>Статей нет.</EmptyState>
              ) : (
                overview.publications.articles.items.map((article) => (
                  <RowLink
                    key={article.id}
                    href={`/admin/content/articles/${article.id}/edit`}
                    title={article.title}
                    subtitle={formatAgo(article.updatedAt)}
                    trailing={
                      <Badge className={statusBadgeClass(article.status)}>
                        {CONTENT_STATUS_LABELS[article.status]}
                      </Badge>
                    }
                  />
                ))
              )}
            </div>
            {overview.publications.articles.total > overview.publications.articles.items.length ? (
              <div className="mt-2 text-xs text-gray-500">
                Показаны последние {overview.publications.articles.items.length} из {overview.publications.articles.total}.
              </div>
            ) : null}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пользовательская активность</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CountTile value={overview.customerActivity.planItems} label="В плане" hint="Активные записи" />
            <CountTile value={overview.customerActivity.bookings} label="Заявки" />
            <CountTile value={overview.customerActivity.directThreads} label="Диалоги" />
            <CountTile value={overview.customerActivity.complaints} label="Отправленные жалобы" />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Тексты переписки и комментариев здесь намеренно не показываются: для карточки администратора
            достаточно факта и количества, а содержимое открывается только в профильном модуле.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последняя значимая активность</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recentActions.length === 0 ? (
            <EmptyState>Значимых действий пока нет.</EmptyState>
          ) : (
            <div className="divide-y divide-gray-100">
              {overview.recentActions.map((action) => {
                const body = (
                  <div className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{action.title}</div>
                      <div className="mt-1 text-xs text-gray-500">{action.detail}</div>
                    </div>
                    <div className="shrink-0 text-xs text-gray-500">{formatAgo(action.at)}</div>
                  </div>
                );

                return action.href ? (
                  <Link key={action.id} href={action.href} className="block hover:bg-gray-50">
                    {body}
                  </Link>
                ) : (
                  <div key={action.id}>{body}</div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Действия модерации</CardTitle>
        </CardHeader>
        <CardContent>
          <UserModerationForm
            userId={userId}
            currentStatus={user.status}
            onSuccess={fetchUserDetails}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История модерации</CardTitle>
        </CardHeader>
        <CardContent>
          {moderationHistory.length === 0 ? (
            <div className="py-4 text-center text-gray-500">Нарушений и ограничений нет</div>
          ) : (
            <div className="space-y-4">
              {moderationHistory.map((action) => (
                <div key={action.id} className="border-l-2 border-gray-200 py-2 pl-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{ACTION_LABELS[action.actionType]}</Badge>
                    <span className="text-sm text-gray-500">{formatAgo(action.createdAt)}</span>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Причина: {action.reason}</div>
                    {action.note ? <div className="text-gray-600">Заметка: {action.note}</div> : null}
                    {action.expiresAt ? (
                      <div className="text-gray-600">
                        Истекает: {format(new Date(action.expiresAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </div>
                    ) : null}
                    <div className="mt-1 text-gray-500">Модератор: {action.createdBy.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Журнал аудита</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <div className="py-4 text-center text-gray-500">Нет записей</div>
          ) : (
            <div className="space-y-2">
              {auditLog.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 border-b py-2 text-sm last:border-0 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="text-gray-500 sm:min-w-[140px]">
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
