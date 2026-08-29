import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureDayScenario,
  getDayScenario,
  computePlanFingerprint,
  listPlanItemsByDateForScenario,
  listScenarioItemOverrides,
  listConfirmedBookingActivityIds,
} from "@/server/services/dayScenario.service";
import {
  resolveScenarioItemTime,
  sortScenarioItemsByEffectiveTime,
  deriveEndOfDay,
} from "@/features/my-plan/lib/scenarioProjection";
import { getCurrentUser } from "@/lib/auth/server";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatActivityAddressLine } from "@/features/my-plan/lib/formatActivityAddress";
import { formatScenarioPriceLabel } from "@/features/my-plan/lib/scenarioPricing";
import { computeScenarioGap, type ScenarioCoordinates } from "@/features/my-plan/lib/scenarioTravel";
import { detectScenarioConflicts } from "@/features/my-plan/lib/detectScenarioConflicts";
import { resolveScenarioScheduling } from "@/features/my-plan/lib/scenarioScheduling";
import { canOpenDayScenario } from "@/features/my-plan/lib/canOpenDayScenario";
import { ScenarioDraftEditor } from "@/features/my-plan/components/ScenarioDraftEditor";
import { IcBack, IcMapPin, IcClock, IcCalendar } from "@/features/my-plan/components/scenarioIcons";
import { refreshDayScenarioAction } from "./actions";
import styles from "@/features/my-plan/components/scenarioDay.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  params: Promise<{ city: string; date: string }>;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatDayMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Minsk" });
}

function pluralEvents(n: number): string {
  return n === 1 ? "событие" : n < 5 ? "события" : "событий";
}

function activityCoords(activity: {
  place: { lat: number | null; lng: number | null } | null;
  venue: { place: { lat: number | null; lng: number | null } | null } | null;
} | null): ScenarioCoordinates | null {
  const place = activity?.place ?? activity?.venue?.place ?? null;
  return place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null;
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

  const items = await listPlanItemsByDateForScenario(user.id, date);

  // An already-created Scenario is always shown (never hidden just because
  // My Plan later dropped below the 3-item threshold) — only the initial
  // creation is gated on the threshold, so the CTA/URL can't silently
  // materialize one below 3 items.
  let existingScenario = await getDayScenario(user.id, date);
  if (!existingScenario && canOpenDayScenario(items.length)) {
    existingScenario = await ensureDayScenario(user.id, date, items);
  }

  const weekday = formatWeekday(date);
  const dayMonth = formatDayMonth(date);

  if (!existingScenario) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <BackLink />
          <h1 className={`${styles.title} ${styles.serif}`}>
            {weekday}, <span className={styles.titleAccent}>{dayMonth}</span>
          </h1>
          <div className={styles.empty}>
            <h2>Пока недостаточно событий</h2>
            <p>Добавьте хотя бы три активности на {weekday.toLowerCase()}, {dayMonth}, чтобы собрать сценарий дня.</p>
            <Link href="/me/plan" className={styles.emptyLink}>
              Перейти в план
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const overrides = await listScenarioItemOverrides(existingScenario.id);
  const currentFingerprint = computePlanFingerprint(
    items,
    overrides,
    existingScenario.acceptedConflictKeys,
  );
  const planChanged = currentFingerprint !== existingScenario.planFingerprint;

  const bookedActivityIds = await listConfirmedBookingActivityIds(
    user.id,
    items.map((item) => item.activityId).filter((id): id is string => id != null),
  );

  const withTiming = items.map((item) => {
    const timing = resolveScenarioItemTime(item, overrides.get(item.id) ?? null);
    const scheduling = resolveScenarioScheduling({ activity: item.activity, timing });
    return {
      id: item.id,
      activityId: item.activityId,
      activity: item.activity,
      title: item.title || item.activity?.title || "Активность",
      href:
        item.activityId && item.activity
          ? publicActivityPath(item.activityId, city.slug, item.activity.slug)
          : null,
      addressLabel: item.activity ? formatActivityAddressLine(item.activity) : null,
      priceLabel: formatScenarioPriceLabel(item.activity),
      isBooked: item.activityId != null && bookedActivityIds.has(item.activityId),
      coords: activityCoords(item.activity),
      durationMinutes: scheduling.durationMinutes,
      imageUrl: item.coverImageUrl || item.activity?.coverImageUrl || null,
      effectiveStartsAt: timing.effectiveStartsAt,
      isFlexible: timing.isFlexible,
      createdAt: item.createdAt,
      scheduling,
    };
  });

  const sorted = sortScenarioItemsByEffectiveTime(withTiming);

  const conflicts = detectScenarioConflicts(
    sorted.map((item) => ({ id: item.id, contentId: item.activityId, scheduling: item.scheduling })),
  );

  const clientItems = sorted.map((item) => ({
    planItemId: item.id,
    activityId: item.activityId,
    activitySessionId:
      item.activity?.sessions.find(
        (session) => session.startsAt.getTime() === item.scheduling.startsAt?.getTime(),
      )?.id ?? null,
    title: item.title,
    coverImageUrl: item.imageUrl,
    href: item.href,
    startsAt: item.scheduling.startsAt?.toISOString() ?? null,
    endsAt: item.scheduling.endsAt?.toISOString() ?? null,
    durationMinutes: item.scheduling.durationMinutes,
    schedulingKind: item.scheduling.kind,
    canReschedule: item.scheduling.canReschedule,
    priceLabel: item.priceLabel,
    addressLabel: item.addressLabel,
    isBooked: item.isBooked,
  }));

  // Estimated travel-time gaps between originally-adjacent items — computed
  // once from the canonical (pre-edit) order and shown only while that pair
  // stays unedited; the client refreshes these values after a successful save.
  const gaps: Record<string, ReturnType<typeof computeScenarioGap>> = {};
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const next = sorted[i]!;
    gaps[next.id] = computeScenarioGap({
      previousEndsAt: previous.scheduling.endsAt,
      nextStartsAt: next.scheduling.startsAt,
      previousCoords: previous.coords,
      nextCoords: next.coords,
    });
  }

  const timedSorted = sorted.filter(
    (item): item is typeof item & { effectiveStartsAt: Date } => item.effectiveStartsAt != null,
  );
  const flexibleCount = sorted.length - timedSorted.length;
  const endOfDay = deriveEndOfDay(
    timedSorted.map((item) => ({
      id: item.id,
      effectiveStartsAt: item.effectiveStartsAt,
      durationMinutes: item.durationMinutes,
    })),
  );

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <BackLink />

        <div className={styles.headTop}>
          <span className={`${styles.caps} ${styles.kicker}`}>● Сценарий дня</span>
          <h1 className={`${styles.title} ${styles.serif}`}>
            {weekday}, <span className={styles.titleAccent}>{dayMonth}</span>
          </h1>
          <p className={styles.cityLine}>{city.name}</p>

          <div className={styles.sum}>
            <span className={styles.st}>
              <IcMapPin />
              {city.name}
            </span>
            {timedSorted.length > 0 ? (
              <span className={styles.st}>
                <IcClock />
                <b>
                  {formatTime(timedSorted[0]!.effectiveStartsAt)}
                  {timedSorted.length > 1 ? `–${formatTime(timedSorted.at(-1)!.effectiveStartsAt)}` : ""}
                </b>
              </span>
            ) : null}
            <span className={styles.st}>
              <IcCalendar />
              <b>
                {sorted.length} {pluralEvents(sorted.length)}
              </b>
              {flexibleCount > 0 ? ` · ${flexibleCount} гибко` : ""}
            </span>
          </div>
        </div>

        {planChanged ? (
          <div className={styles.changed}>
            <p>План изменился</p>
            <form action={refreshDayScenarioAction.bind(null, city.slug, date)}>
              <button type="submit" className={styles.refreshBtn}>
                Обновить сценарий
              </button>
            </form>
          </div>
        ) : null}

        <ScenarioDraftEditor
          items={clientItems}
          conflicts={conflicts}
          acceptedConflictKeys={existingScenario.acceptedConflictKeys}
          fingerprint={currentFingerprint}
          city={city.slug}
          date={date}
          gaps={gaps}
          endOfDayLabel={endOfDay ? formatTime(endOfDay) : null}
        />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/me/plan" className={styles.back}>
      <IcBack />
      Мой план
    </Link>
  );
}
