import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

async function saveFamilyHomeCity(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const cityId = String(formData.get("cityId") ?? "");
  const city = await prisma.city.findFirst({
    where: { id: cityId, isActive: true, isLegacyNonCity: false, country: { slug: "belarus" } },
    select: { id: true },
  });
  if (!city) throw new Error("Выберите доступный город.");
  const membership = await prisma.familyMembership.findFirst({
    where: { userId: user.id, leftAt: null, role: "OWNER", family: { archivedAt: null } },
    select: { familyId: true },
  });
  if (!membership) throw new Error("Домашний город может изменить только владелец семьи.");
  await prisma.family.update({ where: { id: membership.familyId }, data: { homeCityId: city.id } });
  redirect("/me/profile");
}

export default async function FamilyHomeCityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/me/settings/family-city");
  const membership = await prisma.familyMembership.findFirst({
    where: { userId: user.id, leftAt: null, family: { archivedAt: null } },
    select: { role: true, family: { select: { homeCityId: true } } },
  });
  const cities = await prisma.city.findMany({
    where: { isActive: true, isLegacyNonCity: false, country: { slug: "belarus" } },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/me/profile" className="text-sm text-primary">← Моя семья</Link>
      <h1 className="mt-5 text-3xl font-semibold">Домашний город семьи</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Указывается отдельно от города просмотра. Используется для определения интереса семей к событиям других регионов.
      </p>
      {!membership ? <p className="mt-6 text-sm">Сначала создайте семейный профиль.</p>
        : membership.role !== "OWNER" ? <p className="mt-6 text-sm">Изменить город может владелец семьи.</p>
        : (
          <form action={saveFamilyHomeCity} className="mt-6 space-y-4">
            <label htmlFor="cityId" className="block text-sm font-medium">Город</label>
            <select id="cityId" name="cityId" required defaultValue={membership.family.homeCityId ?? ""}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
              <option value="" disabled>Выберите город</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
            <button type="submit" className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white">
              Сохранить домашний город
            </button>
          </form>
        )}
    </main>
  );
}
