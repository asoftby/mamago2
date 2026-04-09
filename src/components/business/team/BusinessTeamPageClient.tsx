"use client";

import { useCallback, useEffect, useState } from "react";
import { BusinessMemberRole, BusinessInviteStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

interface Props {
  businessId: string;
  isOwner: boolean;
}

export function BusinessTeamPageClient({
  businessId,
  isOwner,
}: Props) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [devInviteHint, setDevInviteHint] = useState<string | null>(null);

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
    void loadMembers();
    void loadInvites();
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
      return;
    }
    await loadInvites();
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDevInviteHint(null);
    const res = await fetch(`/api/businesses/${businessId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        title: title.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(mapInviteCreateError(data.error));
      return;
    }
    setEmail("");
    setTitle("");
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
      return "Пользователь с таким email уже в команде";
    }
    if (code === "INVALID_EMAIL") {
      return "Укажите корректный email";
    }
    return "Не удалось отправить приглашение";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Команда</h1>
        <p className="text-gray-600 mt-1">
          Участники и приглашения вашего бизнеса
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Блок 1: участники */}
      <Card>
        <CardHeader>
          <CardTitle>Участники</CardTitle>
          <CardDescription>
            Люди с доступом к кабинету этого бизнеса
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingMembers ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : !members?.length ? (
            <p className="text-sm text-gray-500">Нет данных</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 py-4 px-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {m.user.displayName?.trim() || "Без имени"}
                    </div>
                    <div className="text-sm text-gray-600">{m.user.email}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-800">
                        {ROLE_LABEL[m.role]}
                      </span>
                      {m.title ? (
                        <span className="text-gray-600">{m.title}</span>
                      ) : null}
                      <span className="text-gray-500">
                        с {formatRuDate(m.createdAt)}
                      </span>
                      {!m.isActive && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                          Доступ отключён
                        </span>
                      )}
                    </div>
                  </div>
                  {isOwner &&
                    m.role === BusinessMemberRole.MANAGER &&
                    m.isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-red-700 border-red-200 hover:bg-red-50"
                        disabled={busyId === m.id}
                        onClick={() => void handleDeactivate(m.id)}
                      >
                        Отключить доступ
                      </Button>
                    )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Блок 2: приглашения */}
      <Card>
        <CardHeader>
          <CardTitle>Приглашения</CardTitle>
          <CardDescription>
            {isOwner
              ? "Отправленные приглашения менеджерам"
              : "Список приглашений (только просмотр)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInvites ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : !invites?.length ? (
            <p className="text-sm text-gray-500">
              Пока нет приглашений.{" "}
              {isOwner && "Пригласите менеджера ниже — на email придёт ссылка."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 py-4 px-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{inv.email}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>{ROLE_LABEL[inv.role]}</span>
                      {inv.title ? <span>· {inv.title}</span> : null}
                      <span>
                        · {INVITE_STATUS_LABEL[inv.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Создано {formatRuDate(inv.createdAt)}
                      {inv.status === BusinessInviteStatus.PENDING && (
                        <> · до {formatRuDate(inv.expiresAt)}</>
                      )}
                    </div>
                  </div>
                  {isOwner && inv.status === BusinessInviteStatus.PENDING && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={busyId === inv.id}
                      onClick={() => void handleRevoke(inv.id)}
                    >
                      Отозвать
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Блок 3: форма — только OWNER */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Пригласить менеджера</CardTitle>
            <CardDescription>
              Сотрудник будет добавлен с ролью «Менеджер» и сможет работать в
              кабинете после принятия приглашения по ссылке из письма.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleInviteSubmit(e)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label htmlFor="team-email" className="text-sm font-medium text-gray-700">
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
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="team-title" className="text-sm font-medium text-gray-700">
                  Должность (необязательно)
                </label>
                <Input
                  id="team-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например, администратор зала"
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Отправка…" : "Отправить приглашение"}
              </Button>
            </form>
            {process.env.NODE_ENV === "development" && devInviteHint && (
              <p className="mt-4 text-xs font-mono text-gray-500 break-all border-t pt-4">
                {devInviteHint}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
