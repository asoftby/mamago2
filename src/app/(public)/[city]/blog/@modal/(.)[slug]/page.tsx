import CityArticlePage from "../../[slug]/page";
import { JournalNewsOverlay } from "@/components/journal/JournalNewsOverlay";

export default async function InterceptedJournalArticle({ params }: { params: Promise<{ city: string; slug: string }> }) {
  return (
    <JournalNewsOverlay>
      <CityArticlePage params={params} />
    </JournalNewsOverlay>
  );
}
