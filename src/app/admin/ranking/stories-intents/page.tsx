import Link from "next/link";
import { StoriesManagementPanel } from "./StoriesManagementPanel";
import { StoryIntentRulesPanel } from "./StoryIntentRulesPanel";

type Props = {
  searchParams: Promise<{ tab?: string; cityId?: string; date?: string; filter?: string }>;
};

export default async function StoriesIntentsPage({ searchParams }: Props) {
  const query = await searchParams;
  const tab = query.tab === "rules" ? "rules" : "placements";
  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-gray-900 text-white" : "border bg-white text-gray-700"}`;

  return (
    <main className="space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Stories на главной</h1>
        <p className="mt-1 text-sm text-gray-500">
          Единая точка управления составом и правилами ранжирования Stories.
        </p>
      </header>
      <nav aria-label="Разделы Stories" className="flex gap-2">
        <Link href="/admin/ranking/stories-intents" className={tabClass(tab === "placements")}>
          Состав Stories
        </Link>
        <Link href="/admin/ranking/stories-intents?tab=rules" className={tabClass(tab === "rules")}>
          Правила ранжирования
        </Link>
      </nav>
      {tab === "rules" ? (
        <StoryIntentRulesPanel />
      ) : (
        <StoriesManagementPanel searchParams={Promise.resolve(query)} />
      )}
    </main>
  );
}
