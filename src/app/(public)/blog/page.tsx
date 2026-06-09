import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { BlogIndex } from "./BlogIndex";

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "Журнал — mamaGo",
  description: "Идеи для прогулок, маршруты и советы для семей с детьми",
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: citySlug } = await searchParams;

  // /blog?city=minsk would duplicate /{city}/blog — kill it at the route level.
  // City-scoped blog listing lives exclusively at /{city}/blog.
  if (citySlug) notFound();

  return (
    <main>
      <BlogIndex articles={[]} />
    </main>
  );
}
