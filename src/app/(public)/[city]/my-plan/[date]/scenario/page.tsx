import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import {
  ensureDayScenario,
  getDayScenario,
  computePlanFingerprint,
} from "@/server/services/dayScenario.service";
import { sortPlanItemsForDay } from "@/features/my-plan/lib/sortPlanItemsForDay";
import { detectScenarioConflictIds } from "@/features/my-plan/lib/detectScenarioConflicts";
import { canOpenDayScenario } from "@/features/my-plan/lib/canOpenDayScenario";
import { ScenarioTimeline } from "@/features/my-plan/components/ScenarioTimeline";
import { refreshDayScenarioAction } from "./actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  params: Promise<{ city: string; date: string }>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("ru-RU", { month: "long" });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} ${month}`;
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default async function DayScenarioPage({ params }: PageProps) {
  const { city: citySlug, date } = await params;

  if (!DATE_PATTERN.test(date)) notFound();

  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin();
    return null;
  }

  const city = await findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { slug: true, name: true },
  });
  if (!city) notFound();

  const items = await listPlanItemsByDate(user.id, date);
  const sortedItems = sortPlanItemsForDay(items);

  // An already-created Scenario is always shown (never hidden just because
  // My Plan later dropped below the 3-item threshold) — only the initial
  // creation is gated on the threshold, so the CTA/URL can't silently
  // materialize one below 3 items.
  let existingScenario = await getDayScenario(user.id, date);
  if (!existingScenario && canOpenDayScenario(items.length)) {
    existingScenario = await ensureDayScenario(user.id, date, items);
  }

  const formattedDate = formatDate(date);

  if (!existingScenario) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl bg-[#FFF9F5] px-5 py-8">
        <BackLink />
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">{formattedDate}</h1>
        <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Пока недостаточно событий</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            Добавьте хотя бы три активности на {formattedDate.toLowerCase()}, чтобы собрать
            сценарий дня.
          </p>
          <Link
            href="/me/plan"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Перейти в план
          </Link>
        </div>
      </div>
    );
  }

  const currentFingerprint = computePlanFingerprint(items);
  const planChanged = currentFingerprint !== existingScenario.planFingerprint;
  const conflictIds = detectScenarioConflictIds(items);

  const metaLine = (() => {
    if (sortedItems.length === 0) return "Пока без событий";
    const first = sortedItems.find((item) => item.startsAt)?.startsAt ?? null;
    const last = [...sortedItems].reverse().find((item) => item.startsAt)?.startsAt ?? null;
    const timeRange = first && last ? `${formatTime(first)}–${formatTime(last)}` : "в течение дня";
    const count = sortedItems.length;
    const noun = count === 1 ? "событие" : count < 5 ? "события" : "событий";
    return `${count} ${noun} · ${timeRange}`;
  })();

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-[#FFF9F5] px-5 py-8">
      <BackLink />

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{formattedDate}</h1>
          <p className="mt-1 text-sm text-neutral-500">{city.name}</p>
        </div>
      </div>

      <section className="mt-5 rounded-[28px] border border-[#F8D7C7] bg-[linear-gradient(135deg,#FFF4EC_0%,#FFF9F6_48%,#FFFFFF_100%)] p-5 shadow-[0_12px_40px_-28px_rgba(239,135,89,0.6)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#BE4F2E]/75">
          Сценарий дня
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{metaLine}</p>
      </section>

      {planChanged ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">План изменился</p>
          <form action={refreshDayScenarioAction.bind(null, city.slug, date)}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Обновить сценарий
            </button>
          </form>
        </div>
      ) : null}

      <div className="mt-6">
        <ScenarioTimeline items={sortedItems} conflictIds={conflictIds} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/me/plan"
      className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Мой план
    </Link>
  );
}
