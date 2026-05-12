import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveActivityVertical } from "@/lib/public/publicVerticalResolver";

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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programActivities.map((program) => (
              <a
                key={program.id}
                href={`/${city}/programs/${program.slug || program.id}`}
                className="group block overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:border-[#EF8759]/50 hover:shadow-lg"
              >
                {/* Cover Image */}
                {program.coverImageUrl && (
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={program.coverImageUrl}
                      alt={program.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-foreground">
                    {program.title}
                  </h3>

                  {program.shortDesc && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                      {program.shortDesc}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {program.ageLabel && <span>{program.ageLabel}</span>}
                    {program.place?.title && <span>• {program.place.title}</span>}
                  </div>

                  {/* Price */}
                  {program.priceFrom && (
                    <div className="mt-3 text-lg font-semibold text-[#EF8759]">
                      от {program.priceFrom} BYN
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
