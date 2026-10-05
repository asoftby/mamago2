"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import {
  adultDisplayName,
  familyActions,
  familyErrorMessage,
  roleLabel,
  type MemberRole,
} from "@/features/family/lib/familyMembersView";

export type FamilyMembersCardProps = {
  myRole: MemberRole;
  adults: Array<{ userId: string; displayName: string | null; role: MemberRole; isMe: boolean }>;
  invites: Array<{ id: string; createdAt: string }>;
  invitesEnabled: boolean;
  hasChildren: boolean;
};

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: {} };
  }
}

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";

export function FamilyMembersCard(props: FamilyMembersCardProps) {
  const router = useRouter();
  const { myRole, adults, invites, invitesEnabled, hasChildren } = props;
  const actions = familyActions({ myRole, adultsCount: adults.length, invitesEnabled });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [copyChildren, setCopyChildren] = useState(true);
  const [transferTo, setTransferTo] = useState("");

  const others = adults.filter((a) => !a.isMe);

  async function run(fn: () => Promise<{ ok: boolean; data: Record<string, unknown> }>, onOk: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(familyErrorMessage(res.data.error as string | undefined));
      return;
    }
    onOk(res.data);
  }

  const createInvite = () =>
    run(
      () => call("/api/family/invites", "POST", email.trim() ? { email: email.trim() } : {}),
      (data) => {
        const invite = data.invite as { url: string; emailSent: boolean };
        setLink(invite.url);
        setCopied(false);
        setNotice(invite.emailSent ? "Письмо отправлено. Ссылку можно скопировать и отправить самим." : null);
        setEmail("");
        router.refresh();
      },
    );

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Не удалось скопировать. Выделите ссылку и скопируйте вручную.");
    }
  };

  const revoke = (id: string) =>
    run(() => call(`/api/family/invites/${id}`, "DELETE"), () => {
      setLink(null);
      router.refresh();
    });

  const leave = () =>
    run(() => call("/api/family/leave", "POST", { copyChildren: hasChildren ? copyChildren : false }), () => {
      router.refresh();
    });

  const transfer = () =>
    run(() => call("/api/family/transfer-owner", "POST", { targetUserId: transferTo }), () => {
      setTransferTo("");
      router.refresh();
    });

  return (
    <Surface className="mt-6 p-5 sm:p-6">
      <H2>Взрослые в семье</H2>
      <ul className="mt-3 divide-y divide-neutral-100">
        {adults.map((a) => (
          <li key={a.userId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-neutral-900">{adultDisplayName(a)}</span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">{roleLabel(a.role)}</span>
          </li>
        ))}
      </ul>
      {adults.length > 1 ? (
        <BodyMuted className="mt-2">Дети и общие записи плана видны всем взрослым. Личные записи видите только вы.</BodyMuted>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-green-700">{notice}</p> : null}

      {actions.canInvite ? (
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <h3 className="text-base font-semibold text-neutral-900">Пригласить взрослого</h3>
          <BodyMuted className="mt-1">
            Ссылка одноразовая и без срока действия. Email нужен только чтобы отправить письмо — мы его не сохраняем.
          </BodyMuted>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="Email (необязательно)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-3 text-sm"
            />
            <button type="button" className={btnPrimary} disabled={busy} onClick={createInvite}>
              {email.trim() ? "Отправить приглашение" : "Создать ссылку"}
            </button>
          </div>
          {link ? (
            <div className="mt-3 rounded-xl bg-neutral-50 p-3">
              <p className="break-all text-sm text-neutral-800">{link}</p>
              <button type="button" className={`${btn} mt-2`} onClick={copyLink}>
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </button>
              <p className="mt-2 text-xs text-neutral-500">Ссылка показывается один раз — позже её не восстановить.</p>
            </div>
          ) : null}
          {invites.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm text-neutral-700">
                  <span>Активная ссылка от {new Date(i.createdAt).toLocaleDateString("ru-RU")}</span>
                  <button type="button" className={btn} disabled={busy} onClick={() => revoke(i.id)}>
                    Отозвать
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {actions.canTransfer ? (
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <h3 className="text-base font-semibold text-neutral-900">Передать роль владельца</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-3 text-sm"
            >
              <option value="">Выберите взрослого</option>
              {others.map((a) => (
                <option key={a.userId} value={a.userId}>{adultDisplayName(a)}</option>
              ))}
            </select>
            <button type="button" className={btn} disabled={busy || !transferTo} onClick={transfer}>
              Передать
            </button>
          </div>
          <BodyMuted className="mt-2">Владелец не может выйти из семьи, пока не передаст роль.</BodyMuted>
        </div>
      ) : null}

      {actions.canLeave ? (
        <div className="mt-5 border-t border-neutral-100 pt-5">
          {!leaveOpen ? (
            <button type="button" className={btn} onClick={() => setLeaveOpen(true)}>
              Выйти из семьи
            </button>
          ) : (
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-800">
                Вы создадите свою семью. Ваши личные записи плана уйдут с вами, общие останутся у семьи. Доступ к общим данным пропадёт.
              </p>
              {hasChildren ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-neutral-800">
                  <input type="checkbox" checked={copyChildren} onChange={(e) => setCopyChildren(e.target.checked)} className="mt-1" />
                  <span>Забрать копию профилей детей (дальше они будут независимы)</span>
                </label>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" className={btnPrimary} disabled={busy} onClick={leave}>
                  Выйти
                </button>
                <button type="button" className={btn} disabled={busy} onClick={() => setLeaveOpen(false)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Surface>
  );
}
