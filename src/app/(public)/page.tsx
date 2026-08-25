import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const BASE_URL = getBaseUrl("BY");

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "mamaGo — помощник для семейного отдыха и развития",
  description:
    "mamaGo — удобный помощник в организации семейного отдыха и развития: события, места, занятия, маршруты и идеи для времени с детьми.",
  alternates: { canonical: BASE_URL },
});

export default async function NationalHubPage() {
  const cities = await prisma.city.findMany({
    where: { isActive: true, isLegacyNonCity: false, isVisibleInCityFilter: true },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });

  return (
    <Container className="py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">mamaGo</h1>
        <p className="text-muted-foreground">
          Удобный помощник в организации семейного отдыха и развития: события, места,
          занятия, маршруты и идеи для времени с детьми.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Выберите город</h2>
        {cities.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/${city.slug}`}
                  className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Пока нет доступных городов.</p>
            <p className="mt-2 max-w-2xl">
              Обычно это значит, что в базе ещё не появились активные города для публичного
              каталога. Проверьте seed и настройки видимости города.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/taxonomy/cities">Открыть города в админке</Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  );
}
