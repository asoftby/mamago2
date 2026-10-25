import { notFound } from "next/navigation";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { listPopulatedCityBlogCategories } from "@/server/article/cityBlogCategories";
import { BlogPersistentNav } from "../../blog/BlogPersistentNav";

export default async function CityJournalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  const city = await findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
  if (!city) notFound();
  const categories = await listPopulatedCityBlogCategories(city);

  return (
    <>
      <BlogPersistentNav citySlug={city.slug} categories={categories} />
      {children}
    </>
  );
}
