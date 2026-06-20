import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  listPlanItemsByWeek,
  groupPlanItemsByDate,
  getCurrentWeekStart,
} from "@/server/services/plan.service";
import { listRoutesByUser } from "@/server/services/route.service";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import { listUserBirthdayParties } from "@/server/services/userBirthdays.service";
import { buildAdultPreferenceDisplayLine } from "@/lib/adultPersonaSignals/buildAdultPreferenceLine";
import { getSystemInterestLabel } from "@/lib/config/interests";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import { getPartyDisplayTitle } from "@/features/me/lib/userBirthdayPartyUi";
import { getPartyScenarioFlowUi } from "@/features/me/lib/partyScenarioFlow";
import { getBirthdayBuilderHref } from "@/lib/birthday/getBirthdayBuilderHref";
import {
  AccountDesign,
  type AccountFamilyMember,
  type AccountRoute,
  type AccountParty,
} from "@/features/me/components/account/AccountDesign";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

/** «6 лет» / «8 мес.» / «Возраст не указан». */
function ageLine(birthDate: Date | null): string {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return "Возраст не указан";
  const now = new Date();
  const months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (months < 12) return `${months} мес.`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
}

/** «6 июня · 13:00–16:00» — separator matches the design. */
function partyDateTime(dateIso: string | null, start: string | null, end: string | null): string {
  if (!dateIso) return [start, end].filter(Boolean).join("–");
  const d = new Date(`${dateIso}T12:00:00`);
  const dateStr = Number.isNaN(d.getTime())
    ? dateIso
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = start && end ? `${start}–${end}` : (start ?? "");
  return time ? `${dateStr} · ${time}` : dateStr;
}

export default async function MePage({ searchParams }: PageProps) {
  await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // ── Children (with interests, raw queries to dodge TS issues) ──
  const childrenRaw = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const childIds = childrenRaw.map((c) => c.id);

  type SystemInterest = { childId: string; interestSlug: string };
  type CustomInterest = { childId: string; label: string };
  let systemInterestsData: SystemInterest[] = [];
  let customInterestsData: CustomInterest[] = [];
  if (childIds.length > 0) {
    systemInterestsData = (await prisma.$queryRaw`
      SELECT "childId", "interestSlug"
      FROM "ChildInterest"
      WHERE "childId" = ANY(${childIds})
    `) as SystemInterest[];
    customInterestsData = (await prisma.$queryRaw`
      SELECT "childId", "label"
      FROM "ChildCustomInterest"
      WHERE "childId" = ANY(${childIds})
    `) as CustomInterest[];
  }

  // ── Plan (kept for parity with prior data loading) ──
  const weekStart = getCurrentWeekStart();
  const planItems = await listPlanItemsByWeek(user.id, weekStart);
  groupPlanItemsByDate(planItems);

  // ── Routes & parties ──
  const userRoutes = await listRoutesByUser(user.id).catch(() => []);
  const birthdayParties = await listUserBirthdayParties(user.id);

  // ── Greeting / identity ──
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const firstName = user.displayName ?? user.email?.split("@")[0] ?? "Пользователь";

  const preferenceDisplayLine = await buildAdultPreferenceDisplayLine({
    preferenceSignalIds: user.preferenceSignalIds ?? [],
    leisureFormatSignalId: user.leisureFormatSignalId ?? null,
    preferenceSummary: user.preferenceSummary,
    leisureFormatSummary: user.leisureFormatSummary,
  });

  // ── Family: adult first, then children ──
  const adultRole = [mapFamilyRoleToLabel(user.familyRole), user.ageBandLabel]
    .filter((v) => v && String(v).trim())
    .join(" · ");
  const family: AccountFamilyMember[] = [
    {
      key: "me",
      initial: firstName.charAt(0).toUpperCase(),
      name: user.displayName?.trim() || "Я",
      role: adultRole || "Родитель",
      hint: preferenceDisplayLine?.trim() || "Настроим рекомендации",
    },
    ...childrenRaw.map((child): AccountFamilyMember => {
      const interests = [
        ...systemInterestsData
          .filter((i) => i.childId === child.id)
          .map((i) => getSystemInterestLabel(i.interestSlug)),
        ...customInterestsData
          .filter((c) => c.childId === child.id)
          .map((c) => c.label),
      ].filter(Boolean);
      return {
        key: child.id,
        initial: child.name.charAt(0).toUpperCase(),
        name: child.name,
        role: ageLine(child.birthDate ? new Date(child.birthDate) : null),
        interests: interests.slice(0, 3),
        hint: "Добавьте интересы",
      };
    }),
  ];

  // ── Routes ──
  const routes: AccountRoute[] = userRoutes.map((r) => ({
    id: r.id,
    title: r.title,
    points: r.stops.length,
    price: summarizeRouteBudget(r.stops).label,
    status: r.status === "PUBLISHED" ? "published" : "draft",
    href: `/routes/${r.slug}`,
  }));

  // ── Parties ──
  const parties: AccountParty[] = birthdayParties.map((p) => {
    const chips = getPartyScenarioFlowUi(p)?.visible ?? [];
    const confirmedFromChips = chips.filter((c) => c.confirmed).length;
    return {
      id: p.id,
      name: getPartyDisplayTitle(p),
      dateTime: partyDateTime(p.dateIso, p.timeStart, p.timeEnd),
      confirmedOf: p.confirmationCount ?? confirmedFromChips,
      total: p.confirmationTotal ?? chips.length,
      chips,
      href: `/me/birthdays/${p.id}`,
    };
  });

  const stats = [
    { n: family.length, label: "в семье" },
    { n: routes.length, label: "маршрут" },
    { n: parties.length, label: "праздник" },
  ];

  return (
    <AccountDesign
      userName={firstName}
      greeting={greeting}
      stats={stats}
      settingsHref="/me/settings"
      homeHref="/"
      family={family}
      manageFamilyHref="/me/profile"
      bookingsHref="/me/bookings"
      routes={routes}
      createRouteHref="/routes/new"
      parties={parties}
      partiesHref="/me/birthdays"
      createPartyHref={getBirthdayBuilderHref()}
    />
  );
}
