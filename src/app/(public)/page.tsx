import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { Container } from "@/components/ui/Container";

export const dynamic = "force-dynamic";

const BASE_URL = getBaseUrl("BY");

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "mamaGo — семейный гид Беларуси",
  description:
    "Афиша событий, занятия для детей, маршруты и журнал для семей. Выберите свой город.",
  alternates: { canonical: BASE_URL },
});

export default async function NationalHubPage() {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });

  return (
    <Container className="py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">mamaGo</h1>
        <p className="text-muted-foreground">
          Семейный гид Беларуси: события, занятия, маршруты и идеи для досуга с детьми.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Выберите город</h2>
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
      </div>
    </Container>
  );
}
