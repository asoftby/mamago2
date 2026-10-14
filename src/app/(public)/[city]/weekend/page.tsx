import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { isWeekendDateInWindow, nextWeekendDates } from "@/features/weekend/weekendRules";
import { WeekendPlanner } from "@/features/weekend/WeekendPlanner";

export const metadata: Metadata = { title: "Мой выходной — mamaGo (тест)", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WeekendPage({ params, searchParams }: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [user, { city: citySlug }, query] = await Promise.all([getCurrentUser(), params, searchParams]);
  // Not just hiding the banner: direct URL access is forbidden for non-admins.
  if (!user || user.role !== "ADMIN") notFound();
  const city = await findCityBySlug(citySlug.toLowerCase(), { isActive: true });
  if (!city) notFound();
  const today = getLocalDateKey();
  const first = nextWeekendDates(today)[0];
  const date = query.date && isWeekendDateInWindow(query.date, today) ? query.date : first;
  return <WeekendPlanner citySlug={city.slug} cityName={city.name} initialDate={date} />;
}
