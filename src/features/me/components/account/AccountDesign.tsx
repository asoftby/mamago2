"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Plus, Settings } from "lucide-react";
import { AccountCard, AccountPage } from "@/components/account/AccountPage";
import { BodyMuted } from "@/components/ui/typography";
import { AddParticipantModal, type ParticipantChildData } from "@/components/children/AddParticipantModal";
import { FamilyMembersCard, type FamilyMembersCardProps } from "@/features/family/components/FamilyMembersCard";
import { getGreetingForHour } from "@/features/me/lib/accountGreeting";

/* Страница «Мой аккаунт»: общий каркас AccountPage + карточки эталона «Моя семья».
   Данные приходят с сервера через props. */

export type AccountFamilyMember = {
  key: string;
  initial: string;
  name: string;
  role: string;
  /** Italic helper line when the member has no interest chips. */
  hint?: string;
  /** Interest chips (children). When present, replaces `hint`. */
  interests?: string[];
  /** "me" — текущий взрослый (правка через editAdult); "child" — ребёнок (childData). */
  kind?: "me" | "child";
  /** Полные данные ребёнка для модалки правки. */
  childData?: ParticipantChildData;
};

export type AccountRoute = {
  id: string;
  title: string;
  points: number;
  price: string;
  status: "published" | "draft";
  href: string;
};

export type AccountParty = {
  id: string;
  name: string;
  dateTime: string;
  confirmedOf: number;
  total: number;
  chips: { label: string; confirmed: boolean }[];
  href: string;
};

export type AccountDesignProps = {
  userName: string;
  greeting: string;
  settingsHref: string;
  family: AccountFamilyMember[];
  /** Блок «Взрослые в семье / Пригласить» — null при выключенных флагах семьи. */
  familyBlock?: Omit<FamilyMembersCardProps, "variant"> | null;
  bookingsHref: string;
  routes: AccountRoute[];
  createRouteHref: string;
  parties: AccountParty[];
  partiesHref: string;
  createPartyHref: string;
};

const MEMBER =
  "flex min-h-11 w-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-300 disabled:cursor-default sm:w-56";
const GHOST_BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50";
const PRIMARY_BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800";

export function AccountDesign(props: AccountDesignProps) {
  const {
    userName,
    greeting,
    settingsHref,
    family,
    familyBlock,
    bookingsHref,
    routes,
    createRouteHref,
    parties,
    partiesHref,
    createPartyHref,
  } = props;

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<AccountFamilyMember | null>(null);
  const closeMemberModal = () => {
    setIsAddMemberOpen(false);
    setEditingMember(null);
  };
  const editable = (m: AccountFamilyMember) => m.kind === "me" || (m.kind === "child" && !!m.childData);
  const [localGreeting, setLocalGreeting] = useState(greeting);

  useEffect(() => {
    const updateGreeting = () => {
      setLocalGreeting(getGreetingForHour(new Date().getHours()));
    };
    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <AccountPage
      title={userName}
      lead={`${localGreeting}! Семья, маршруты и праздники — всё в одном месте. Настройте профиль, чтобы рекомендации были точнее.`}
      actions={
        <Link href={settingsHref} className={GHOST_BTN}>
          <Settings className="h-4 w-4" aria-hidden="true" /> Настройки
        </Link>
      }
    >
      <div className="space-y-6">
        <AccountCard title="Моя семья">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {family.map((m) => (
              <button
                key={m.key}
                type="button"
                className={MEMBER}
                disabled={!editable(m)}
                aria-label={`Редактировать: ${m.name}`}
                onClick={() => {
                  setEditingMember(m);
                  setIsAddMemberOpen(true);
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-base font-semibold text-orange-700">
                    {m.initial}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-neutral-900">{m.name}</span>
                    <span className="block text-sm text-neutral-600">{m.role}</span>
                  </span>
                </span>
                {m.interests && m.interests.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {m.interests.map((i, idx) => (
                      <span key={idx} className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600">
                        {i}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-500">{m.hint}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 p-4 text-sm text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 sm:w-44"
              onClick={() => {
                setEditingMember(null);
                setIsAddMemberOpen(true);
              }}
              aria-label="Добавить ребёнка"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Добавить ребёнка
            </button>
          </div>
        </AccountCard>

        {familyBlock ? <FamilyMembersCard {...familyBlock} /> : null}

        <Link
          href={bookingsHref}
          className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <AccountCard className="flex items-center gap-4 transition-colors hover:border-neutral-300">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <CalendarCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-neutral-900">Заявки и бронирования</span>
              <span className="mt-1 block text-sm text-neutral-600">Следите за статусом записей на занятия и события</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
          </AccountCard>
        </Link>

        {/* Маршруты и праздники скрыты до релиза разделов. */}
        {false && (
          <AccountCard title="Мои маршруты" action={<Link href={createRouteHref} className="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">+ Создать</Link>}>
            {routes.length === 0 ? (
              <BodyMuted>У вас пока нет маршрутов</BodyMuted>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {routes.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="flex min-h-11 items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-neutral-900">{r.title}</span>
                        <span className="block text-sm text-neutral-600">
                          {r.points} {r.points === 1 ? "точка" : "точки"} · {r.price} · {r.status === "published" ? "Опубликован" : "Черновик"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AccountCard>
        )}

        {false && (
          <AccountCard title="Мои праздники" action={<Link href={partiesHref} className="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">Смотреть все</Link>}>
            {parties.length === 0 ? (
              <div className="space-y-3">
                <BodyMuted>Здесь появятся ваши праздники</BodyMuted>
                <Link href={createPartyHref} className={PRIMARY_BTN}>Создать праздник</Link>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {parties.map((p) => (
                  <li key={p.id} className="py-3">
                    <Link href={p.href} className="flex min-h-11 items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm text-neutral-600">{p.dateTime}</span>
                        <span className="block truncate text-base font-semibold text-neutral-900">{p.name}</span>
                        <span className="block text-sm text-neutral-600">
                          {p.total > 0 && p.confirmedOf === p.total ? "Все подтвердили" : `Подтвердили ${p.confirmedOf} из ${p.total}`}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AccountCard>
        )}
      </div>

      <AddParticipantModal
        isOpen={isAddMemberOpen}
        onClose={closeMemberModal}
        childData={editingMember?.kind === "child" ? editingMember.childData : undefined}
        editAdult={editingMember?.kind === "me"}
        childOnly={editingMember?.kind !== "me"}
      />
    </AccountPage>
  );
}
