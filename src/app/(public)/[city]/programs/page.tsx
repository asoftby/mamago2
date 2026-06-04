import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { resolveActivityVertical } from "@/lib/public/publicVerticalResolver";
import { OfferCard } from "@/components/offers/OfferCard";
import { formatPriceFrom } from "@/lib/formatters/format-price";

interface ProgramsPageProps {
  params: Promise<{
    city: string;
  }>;
}

export async function generateMetadata({ params }: ProgramsPageProps): Promise<Metadata> {
  const { city } = await params;

  // Find city
  const cityData = await prisma.city.findUnique({
    where: { slug: city },
    select: { name: true },
  });

  if (!cityData) {
    return {
      title: "Город не найден",
    };
  }

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const cityName = cityData.name;

  return {
    title: `Занятия для детей в ${cityName} — mamaGo`,
    description: `Курсы, лагеря, секции и программы для детей в ${cityName}. Выбирайте занятия по возрасту, формату и интересам.`,
    openGraph: {
      title: `Занятия для детей в ${cityName}`,
      description: `Курсы, лагеря, секции и программы для детей в ${cityName}`,
      type: "website",
      url: `${publicBase}/${city}/programs`,
    },
    alternates: {
      canonical: `${publicBase}/${city}/programs`,
    },
  };
}

export default async function ProgramsPage({ params }: ProgramsPageProps) {
  const { city } = await params;

  // Find city
  const cityData = await prisma.city.findUnique({
    where: { slug: city },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!cityData) {
    notFound();
  }

  // Fetch published PROGRAM offers
  const programs = await prisma.activity.findMany({
    where: {
      type: "OFFER",
      status: "PUBLISHED",
      // TODO: Add city filter when cityId is properly set on activities
    },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDesc: true,
      coverImageUrl: true,
      priceFrom: true,
      ageLabel: true,
      type: true,
      place: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  // Filter only PROGRAM vertical activities
  const programActivities = programs.filter((activity) => {
    const vertical = resolveActivityVertical(activity.type, null);
    return vertical === "PROGRAM";
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Занятия для детей в {cityData.name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Курсы, лагеря, секции и программы для детей. Выбирайте занятия по возрасту, формату и
            интересам.
          </p>
        </div>

        {/* Programs Grid */}
        {programActivities.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
            <p className="text-muted-foreground">
              Пока нет доступных программ в {cityData.name}. Скоро здесь появятся лагеря, курсы и
              занятия для детей.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {programActivities.map((program) => {
              const href = `/${city}/programs/${program.slug || program.id}`;
              const metaLabel = [program.ageLabel, program.place?.title]
                .filter(Boolean)
                .join(" · ") || undefined;
              const priceLabel = program.priceFrom != null
                ? formatPriceFrom(program.priceFrom)
                : undefined;
              return (
                <OfferCard
                  key={program.id}
                  id={program.id}
                  title={program.title}
                  href={href}
                  imageUrl={program.coverImageUrl}
                  dateLabel={metaLabel}
                  priceLabel={priceLabel}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
