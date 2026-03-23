import type { Metadata } from "next";
import { KudaDiscoveryPage } from "@/features/discovery/pages/KudaDiscoveryPage";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const metadata: Metadata = {
  title: "Куда пойти с ребёнком в Минске — mamaGo",
  description:
    "Афиша семейных событий, места и развлечения для детей в Минске. Фильтры по возрасту и району.",
};

export default async function MinskKudaPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  return <KudaDiscoveryPage citySlug="minsk" searchParams={resolved} />;
}
