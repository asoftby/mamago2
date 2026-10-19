"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Circle, Eye, MapPin, MessageCircle, PlayCircle, Tag, BarChart3 } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import { BusinessInboxPreview } from "./BusinessInboxPreview";
import { BusinessOnboardingTour, sendBusinessOnboardingAction } from "./BusinessOnboardingTour";
import type { DashboardData } from "./DashboardClient";

const TYPES = [
  { id: "place", label: "Место", description: "Центр, студия или площадка", Icon: MapPin, href: "/editor/place/new" },
  { id: "event", label: "Событие", description: "Мероприятие с датой и временем", Icon: CalendarDays, href: "/editor/event/new" },
  { id: "offer", label: "Предложение", description: "Услуга, занятие или лагерь", Icon: Tag, href: "/editor/offer/new" },
] as const;

type Props = {
  data: Pick<DashboardData, "hrefs" | "inboxPreview" | "onboarding" | "onboardingPublicHref">;
};

export function NewBusinessDashboard({ data }: Props) {
  const { onboarding } = data;
  const [tourOpen, setTourOpen] = useState(() => !data.onboarding.tourCompleted && !data.onboarding.tourSkipped && !data.onboarding.hasAny);
  const [selected, setSelected] = useState<(typeof TYPES)[number]["id"]>("place");
  const [viewed, setViewed] = useState(false);
  const chosen = TYPES.find((type) => type.id === selected) ?? TYPES[2];
  const hasDraft = Boolean(onboarding.draft);
  const hasPending = Boolean(onboarding.pending);
  const hasLive = Boolean(onboarding.published);
  const isViewed = onboarding.viewedPublished || viewed;

  useEffect(() => {
    if (!onboarding.startedAt) {
      void sendBusinessOnboardingAction("start");
    }
  }, [onboarding.startedAt]);

  const title = hasLive
    ? "Ваша первая публикация готова!"
    : hasPending
      ? "Публикация отправлена на проверку"
      : hasDraft
        ? "Продолжите первую публикацию"
        : "Ваша компания подтверждена!";
  const subtitle = hasLive
    ? "Теперь семьи могут находить вашу публикацию. Проверьте, как она выглядит, и познакомьтесь с результатами."
    : hasPending
      ? "Вы сделали важный шаг. Пока материалы проверяются, изучите возможности кабинета."
      : hasDraft
        ? "Мы сохранили ваш черновик. Вернитесь к нему, когда будете готовы."
        : "Теперь вы можете размещать места, события и предложения для семей. Начните с подходящего формата — для создания первой публикации пополнять баланс не требуется.";

  const steps = [
    { label: "Компания подтверждена", hint: "Документы одобрены — бизнес-инструменты доступны", complete: true },
    { label: "Создана первая карточка", hint: "Место, событие или предложение", complete: onboarding.hasAny },
    { label: "Первая карточка опубликована", hint: "После проверки и публикации", complete: hasLive },
    { label: "Проверен публичный результат", hint: "Откройте свою карточку как посетитель", complete: hasLive && isViewed },
  ];
  const completed = steps.filter((step) => step.complete).length;

  const draft = onboarding.draft;
  const draftLink = draft
    ? `/editor/${draft.kind}/${encodeURIComponent(draft.id)}/edit?returnTo=${encodeURIComponent("/business/dashboard")}`
    : null;

  const publicHref = data.onboardingPublicHref;
  const openPublic = () => {
    if (!publicHref) return;
    setViewed(true);
    void sendBusinessOnboardingAction("public_open");
  };

  return (
    <div className="space-y-5">
      <BusinessSurfaceCard className="p-5 sm:p-8" data-business-tour="intro">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Компания подтверждена · Ваш старт на mamaGo</p>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{subtitle}</p>
            {!hasLive && <p className="mt-2 text-xs text-stone-500">Перед появлением на сайте публикация проходит модерацию. Её статус можно посмотреть в разделе «Публикации».</p>}
          </div>
          <button type="button" onClick={() => setTourOpen(true)} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            <PlayCircle className="h-4 w-4" /> Обзор кабинета
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5" data-business-tour="create">
            {!hasLive && draftLink ? (
              <Link href={draftLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto">
                Продолжить черновик <ArrowRight className="h-4 w-4" />
              </Link>
            ) : !hasLive && hasPending ? (
              <Link href={data.hrefs.publications} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto">
                Посмотреть мои публикации <ArrowRight className="h-4 w-4" />
              </Link>
            ) : hasLive ? (
              <div className="flex flex-wrap gap-3">
                {publicHref && (
                  <Link href={publicHref} onClick={openPublic} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
                    <Eye className="h-4 w-4" /> Посмотреть публикацию
                  </Link>
                )}
                <Link href={data.hrefs.publications} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
                  Все публикации
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-stone-900">С чего хотите начать?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TYPES.map(({ id, label, description, Icon }) => (
                    <button key={id} type="button" aria-pressed={selected === id} onClick={() => setSelected(id)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${selected === id ? "border-primary bg-primary/5" : "border-stone-200 hover:bg-stone-50"}`}>
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-stone-600" />
                      <span>
                        <span className="block text-sm font-semibold text-stone-900">{label}</span>
                        <span className="mt-1 block text-xs text-stone-500">{description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={chosen.href} data-business-tour-target="create-button" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto">
                    Создать публикацию <ArrowRight className="h-4 w-4" />
                  </Link>
                  <CreatePublicationQuickMenu publicationMode="business" trigger={(onClick) => (
                    <button type="button" onClick={onClick} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
                      Все форматы
                    </button>
                  )} />
                </div>
              </div>
            )}
            {hasLive && !publicHref && (
              <p className="text-sm text-stone-500">Публичная ссылка появится, когда карточка получит адрес. Пока можно открыть список публикаций.</p>
            )}
            {(hasDraft || hasPending || hasLive) && (
              <div data-business-tour-target="create-button" className="inline-flex">
                <CreatePublicationQuickMenu publicationMode="business" trigger={(onClick) => (
                  <button type="button" onClick={onClick} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
                    Создать публикацию
                  </button>
                )} />
              </div>
            )}
          </div>

          <div className="rounded-xl bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-stone-900">Ваш прогресс</h3>
              <span className="text-xs font-medium tabular-nums text-stone-500">{completed} из 4</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completed * 25}%` }} />
            </div>
            <div className="mt-4 space-y-3">
              {steps.map((step) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  {step.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />}
                  <div>
                    <p className={`text-xs font-semibold ${step.complete ? "text-stone-600" : "text-stone-900"}`}>{step.label}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{step.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BusinessSurfaceCard>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Результаты ваших публикаций">
        <div data-business-tour-target="publications" className="h-full">
          <BusinessSurfaceCard className="h-full p-5">
            <h3 className="text-sm font-semibold text-stone-950">Публикации</h3>
            <p className="mt-2 text-sm text-stone-600">Здесь вы сможете отслеживать свои карточки и их статус после модерации.</p>
            <Link href={data.hrefs.publications} className="mt-3 inline-flex text-sm font-medium text-primary">Посмотреть публикации →</Link>
          </BusinessSurfaceCard>
        </div>
        <div data-business-tour-target="leads" className="h-full">
          <BusinessSurfaceCard className="h-full p-5">
            <h3 className="text-sm font-semibold text-stone-950">Лиды и обращения</h3>
            <p className="mt-2 text-sm text-stone-600">Новые заявки и обращения клиентов появятся здесь после публикации.</p>
            <Link href={data.hrefs.bookings} className="mt-3 inline-flex text-sm font-medium text-primary">Перейти к обращениям →</Link>
          </BusinessSurfaceCard>
        </div>
      </section>

      <BusinessSurfaceCard className="p-5 sm:p-6" data-business-tour="benefits">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Что умеет mamaGo для бизнеса</h3>
            <p className="mt-1 text-sm text-stone-600">Основные возможности кабинета — без обязательного пополнения баланса.</p>
          </div>
          <button type="button" onClick={() => setTourOpen(true)} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Пройти обзор
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-stone-900">Размещайте публикации</p>
            <p className="text-xs leading-relaxed text-stone-600">Расскажите о площадке, мероприятии или услуге. Следите за статусом модерации.</p>
          </div>
          <div className="space-y-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-stone-900">Изучайте результаты</p>
            <p className="text-xs leading-relaxed text-stone-600">После публикации отслеживайте просмотры и сохранения.</p>
          </div>
          <div className="space-y-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-stone-900">Работайте с обращениями</p>
            <p className="text-xs leading-relaxed text-stone-600">Когда появятся заявки и сообщения, управляйте ими в бизнес-кабинете.</p>
          </div>
        </div>
      </BusinessSurfaceCard>
      <BusinessInboxPreview items={data.inboxPreview} notificationsHref={data.hrefs.bookings} />
      <BusinessOnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
