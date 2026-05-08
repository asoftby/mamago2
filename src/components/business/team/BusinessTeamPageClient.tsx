"use client";

import { useCallback, useEffect, useState } from "react";
import { BusinessInviteStatus, BusinessMemberRole } from "@prisma/client";
import { Mail, Users, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { useToast } from "@/hooks/use-toast";
import { TEAM_POSITIONS } from "@/lib/business/teamPositions";

type MemberRow = {
  id: string;
  role: BusinessMemberRole;
  title: string | null;
  isActive: boolean;
  createdAt: string;
  user: { id: string; email: string; displayName: string | null };
};

type InviteRow = {
  id: string;
  email: string;
  role: BusinessMemberRole;
  status: BusinessInviteStatus;
  title: string | null;
  createdAt: string;
  expiresAt: string;
};

const ROLE_LABEL: Record<BusinessMemberRole, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
};

const INVITE_STATUS_LABEL: Record<BusinessInviteStatus, string> = {
  PENDING: "Ожидает ответа",
  ACCEPTED: "Принято",
  EXPIRED: "Истекло",
  REVOKED: "Отозвано",
};

function formatRuDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[22px] border border-stone-200 bg-stone-50/80 px-4 py-4"
        >
          <div className="h-4 w-40 rounded bg-stone-200" />
          <div className="mt-3 h-3 w-56 rounded bg-stone-200" />
          <div className="mt-3 h-3 w-32 rounded bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

interface Props {
  businessId: string;
  isOwner: boolean;
  inviteNotice?: string;
}

export function BusinessTeamPageClient({ businessId, isOwner, inviteNotice }: Props) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [devInviteHint, setDevInviteHint] = useState<string | null>(null);

  const { toast } = useToast();

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setError(null);
    const res = await fetch(`/api/businesses/${businessId}/members`);
    if (!res.ok) {
      setError("Не удалось загрузить команду");
      setMembers([]);
      setLoadingMembers(false);
      return;
    }
    const data = await res.json();
    setMembers(data.members ?? []);
    setLoadingMembers(false);
  }, [businessId]);

  const loadInvites = useCallback(async () => {
    setLoadingInvites(true);
    const res = await fetch(`/api/businesses/${businessId}/invites`);
    if (!res.ok) {
      setInvites([]);
      setLoadingInvites(false);
      return;
    }
    const data = await res.json();
    setInvites(data.invites ?? []);
    setLoadingInvites(false);
  }, [businessId]);

  useEffect(() => {
    async function loadInitialData() {
      await Promise.all([loadMembers(), loadInvites()]);
    }

    void loadInitialData();
  }, [loadMembers, loadInvites]);

  async function handleDeactivate(memberId: string) {
    if (
      !confirm(
        "Отключить доступ менеджера? Пользователь потеряет доступ к кабинету этого бизнеса.",
      )
    ) {
      return;
    }
    setBusyId(memberId);
    setError(null);
    const res = await fetch(
      `/api/businesses/${businessId}/members/${memberId}/deactivate`,
      { method: "POST" },
    );
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(
        typeof j.error === "string"
          ? mapDeactivateError(j.error)
          : "Не удалось отключить доступ",
      );
      return;
    }
    await loadMembers();
  }

  function mapDeactivateError(code: string): string {
    switch (code) {
      case "CANNOT_DEACTIVATE_OWNER":
        return "Нельзя отключить владельца";
      case "CANNOT_DEACTIVATE_SELF":
        return "Нельзя отключить доступ у самого себя";
      case "NOT_FOUND":
        return "Участник не найден";
      default:
        return "Не удалось отключить доступ";
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!confirm("Отозвать приглашение?")) return;
    setBusyId(inviteId);
    setError(null);
    const res = await fetch(
      `/api/businesses/${businessId}/invites/${inviteId}/revoke`,
      { method: "POST" },
    );
    setBusyId(null);
    if (!res.ok) {
      setError("Не удалось отозвать приглашение");
      toast({
        title: "Ошибка",
        description: "Не удалось отозвать приглашение",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Приглашение отозвано",
      description: "Вы можете отправить новое приглашение на этот email",
    });
    await loadInvites();
  }

  async function handleResend(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    const res = await fetch(
      `/api/businesses/${businessId}/invites/${inviteId}/resend`,
      { method: "POST" },
    );
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const errorMsg = j.error === "EXPIRED" 
        ? "Приглашение истекло. Отправьте новое приглашение."
        : "Не удалось отправить приглашение повторно";
      setError(errorMsg);
      toast({
        title: "Ошибка",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Приглашение отправлено",
      description: "Email с приглашением отправлен повторно",
    });
    await loadInvites();
  }

  async function handleDelete(inviteId: string) {
    if (!confirm("Удалить это приглашение из истории?")) return;
    setBusyId(inviteId);
    setError(null);
    const res = await fetch(
      `/api/businesses/${businessId}/invites/${inviteId}/delete`,
      { method: "DELETE" },
    );
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const errorMsg = j.error === "CANNOT_DELETE_ACTIVE"
        ? "Нельзя удалить активное приглашение. Сначала отзовите его."
        : "Не удалось удалить приглашение";
      setError(errorMsg);
      toast({
        title: "Ошибка",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Приглашение удалено",
      description: "Запись удалена из истории",
    });
    await loadInvites();
  }

  async function handleInviteAgain(invite: InviteRow) {
    if (!confirm(`Отправить новое приглашение на ${invite.email}?`)) return;
    
    setSubmitting(true);
    setError(null);
    setDevInviteHint(null);
    const res = await fetch(`/api/businesses/${businessId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invite.email,
        position: invite.title || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      const errorMsg = mapInviteCreateError(data.error);
      setError(errorMsg);
      toast({
        title: "Ошибка",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Приглашение отправлено",
      description: `Новое приглашение отправлено на ${invite.email}`,
    });
    
    await loadInvites();
    if (
      process.env.NODE_ENV === "development" &&
      data.invite &&
      typeof data.invite.acceptUrl === "string"
    ) {
      setDevInviteHint(`Ссылка для теста (dev): ${data.invite.acceptUrl}`);
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate custom position if "Другое" is selected
    if (position === "custom" && !customPosition.trim()) {
      setError("Укажите должность");
      toast({
        title: "Ошибка",
        description: "Укажите должность",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setDevInviteHint(null);
    
    // Determine final position value
    const finalPosition = position === "custom" 
      ? customPosition.trim() 
      : position 
        ? TEAM_POSITIONS.find(p => p.value === position)?.label 
        : undefined;
    
    const res = await fetch(`/api/businesses/${businessId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        position: finalPosition,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      const errorMsg = mapInviteCreateError(data.error);
      setError(errorMsg);
      toast({
        title: "Ошибка",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    
    // Clear form
    setEmail("");
    setPosition("");
    setCustomPosition("");
    
    toast({
      title: "Приглашение отправлено",
      description: `Email с приглашением отправлен на ${email}`,
    });
    await loadInvites();
    if (
      process.env.NODE_ENV === "development" &&
      data.invite &&
      typeof data.invite.acceptUrl === "string"
    ) {
      setDevInviteHint(`Ссылка для теста (dev): ${data.invite.acceptUrl}`);
    }
  }

  function mapInviteCreateError(code: unknown): string {
    if (code === "DUPLICATE_PENDING") {
      return "Для этого email уже есть активное приглашение";
    }
    if (code === "ALREADY_MEMBER") {
      return "Пользователь уже есть в команде";
    }
    if (code === "INVALID_EMAIL") {
      return "Укажите корректный email";
    }
    return "Не удалось отправить приглашение";
  }

  function isInviteActive(invite: InviteRow): boolean {
    if (invite.status !== BusinessInviteStatus.PENDING) return false;
    return new Date(invite.expiresAt) > new Date();
  }

  return (
    <div className="space-y-8">
      <BusinessSectionHeader
        eyebrow="Team"
        title="Моя команда"
        description="Управляйте доступом к кабинету, приглашайте менеджеров и держите роли команды в одном рабочем пространстве."
        actions={
          <BusinessChip tone="muted" className="px-3 py-2">
            {isOwner ? "Вы управляете доступами" : "Доступ только для просмотра"}
          </BusinessChip>
        }
      />

      {error ? (
        <div
          className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {inviteNotice === "accepted" || inviteNotice === "already-member" ? (
        <div
          className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {inviteNotice === "already-member"
            ? "Вы уже состоите в команде."
            : "Приглашение принято. Добро пожаловать в команду."}
        </div>
      ) : null}

      <BusinessSurfaceCard className="p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Участники</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">
            Люди с доступом к кабинету этого бизнеса.
          </p>
        </div>

        {loadingMembers ? (
          <LoadingRows count={3} />
        ) : !members?.length ? (
          <BusinessEmptyState
            icon={<Users className="h-7 w-7" />}
            title="Пока только вы в команде"
            description={
              isOwner
                ? "Когда появятся менеджеры, здесь будет видно, кто помогает вести бизнес, какие роли у них есть и когда был выдан доступ."
                : "Когда владелец бизнеса добавит участников, здесь появится состав команды."
            }
            secondaryText={
              isOwner
                ? "Приглашения отправляются ниже на этой странице и сразу попадают в рабочий поток кабинета."
                : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 rounded-[22px] border border-stone-200/90 bg-stone-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-stone-950">
                    {member.user.displayName?.trim() || "Без имени"}
                  </div>
                  <div className="mt-1 text-sm text-stone-600">{member.user.email}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <BusinessChip
                      tone={member.role === BusinessMemberRole.OWNER ? "accent" : "muted"}
                    >
                      Роль: {ROLE_LABEL[member.role]}
                    </BusinessChip>
                    {member.title ? (
                      <BusinessChip>Должность: {member.title}</BusinessChip>
                    ) : null}
                    <span className="self-center text-stone-500">
                      с {formatRuDate(member.createdAt)}
                    </span>
                    {!member.isActive ? (
                      <BusinessChip tone="warning">Доступ отключён</BusinessChip>
                    ) : null}
                  </div>
                </div>

                {isOwner &&
                member.role === BusinessMemberRole.MANAGER &&
                member.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-2xl border-red-200 text-red-700 hover:bg-red-50"
                    disabled={busyId === member.id}
                    onClick={() => void handleDeactivate(member.id)}
                  >
                    Отключить доступ
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </BusinessSurfaceCard>

      <BusinessSurfaceCard className="p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Приглашения</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">
            {isOwner
              ? "Отправленные приглашения менеджерам и их текущий статус."
              : "Список приглашений команды в режиме просмотра."}
          </p>
        </div>

        {loadingInvites ? (
          <LoadingRows count={2} />
        ) : !invites?.length ? (
          <BusinessEmptyState
            icon={<Mail className="h-7 w-7" />}
            title="Пока нет приглашений"
            description={
              isOwner
                ? "Приглашайте менеджеров по email, чтобы делегировать работу внутри кабинета без потери контроля."
                : "Если владелец бизнеса отправит приглашения, их статус появится здесь."
            }
          />
        ) : (
          <ul className="space-y-3">
            {invites.map((invite) => {
              const isActive = isInviteActive(invite);
              const isInactive = !isActive && invite.status !== BusinessInviteStatus.ACCEPTED;
              
              return (
                <li
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-[22px] border border-stone-200/90 bg-stone-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-stone-950">{invite.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <BusinessChip tone="muted">Роль: {ROLE_LABEL[invite.role]}</BusinessChip>
                      {invite.title ? (
                        <BusinessChip>Должность: {invite.title}</BusinessChip>
                      ) : null}
                      <BusinessChip
                        tone={
                          invite.status === BusinessInviteStatus.ACCEPTED
                            ? "success"
                            : isActive
                            ? "accent"
                            : "warning"
                        }
                      >
                        {INVITE_STATUS_LABEL[invite.status]}
                      </BusinessChip>
                      <span className="self-center text-stone-500">
                        создано {formatRuDate(invite.createdAt)}
                      </span>
                      {isActive ? (
                        <span className="self-center text-stone-500">
                          до {formatRuDate(invite.expiresAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {isOwner ? (
                    <div className="flex shrink-0 gap-2">
                      {isActive ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-stone-200 bg-white hover:bg-stone-50"
                            disabled={busyId === invite.id}
                            onClick={() => void handleResend(invite.id)}
                            title="Отправить письмо повторно"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span className="ml-1.5">Повторно</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-stone-200 bg-white hover:bg-stone-50"
                            disabled={busyId === invite.id}
                            onClick={() => void handleRevoke(invite.id)}
                          >
                            Отозвать
                          </Button>
                        </>
                      ) : isInactive ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-stone-200 bg-white hover:bg-stone-50"
                            disabled={busyId === invite.id || submitting}
                            onClick={() => void handleInviteAgain(invite)}
                          >
                            Пригласить снова
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-red-200 text-red-700 hover:bg-red-50"
                            disabled={busyId === invite.id}
                            onClick={() => void handleDelete(invite.id)}
                            title="Удалить из истории"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </BusinessSurfaceCard>

      {isOwner ? (
        <BusinessSurfaceCard className="p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">
              Пригласить менеджера
            </h2>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              Сотрудник будет добавлен с ролью «Менеджер» и сможет работать в кабинете после принятия приглашения по ссылке из письма.
            </p>
          </div>

          <form
            onSubmit={(e) => void handleInviteSubmit(e)}
            className="max-w-xl space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="team-email" className="text-sm font-medium text-stone-700">
                Email
              </label>
              <Input
                id="team-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="rounded-2xl border-stone-200 bg-stone-50/70 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="team-role" className="text-sm font-medium text-stone-700">
                Роль в кабинете
              </label>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-2.5 text-sm text-stone-600">
                Менеджер — полный доступ к управлению контентом и настройкам
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="team-position" className="text-sm font-medium text-stone-700">
                Должность (необязательно)
              </label>
              <select
                id="team-position"
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value);
                  if (e.target.value !== "custom") {
                    setCustomPosition("");
                  }
                }}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-2.5 text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
              >
                <option value="">Не указана</option>
                {TEAM_POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>

            {position === "custom" ? (
              <div className="space-y-2">
                <label htmlFor="team-custom-position" className="text-sm font-medium text-stone-700">
                  Укажите должность
                </label>
                <Input
                  id="team-custom-position"
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                  placeholder="Например, координатор мероприятий"
                  maxLength={80}
                  className="rounded-2xl border-stone-200 bg-stone-50/70 focus:bg-white"
                />
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-stone-900 hover:bg-stone-800"
            >
              {submitting ? "Отправка…" : "Отправить приглашение"}
            </Button>
          </form>

          {process.env.NODE_ENV === "development" && devInviteHint ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-stone-300 bg-stone-50 p-4 text-xs leading-6 text-stone-700">
              {devInviteHint}
            </div>
          ) : null}
        </BusinessSurfaceCard>
      ) : null}
    </div>
  );
}
