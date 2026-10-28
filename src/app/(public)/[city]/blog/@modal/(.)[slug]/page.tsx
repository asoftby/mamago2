import CityArticlePage from "../../[slug]/page";
import { JournalNewsOverlay } from "@/components/journal/JournalNewsOverlay";

export default async function InterceptedJournalArticle({ params }: { params: Promise<{ city: string; slug: string }> }) {
  const { city } = await params;
  return (
    <JournalNewsOverlay fallbackHref={`/${city}/blog`}>
      <CityArticlePage params={params} />
    </JournalNewsOverlay>
  );
}
