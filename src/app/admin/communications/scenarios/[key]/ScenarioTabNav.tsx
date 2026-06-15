import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "policy", label: "Политика" },
  { key: "templates", label: "Шаблоны" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabHref(scenarioKey: string, tab: TabKey, channel?: string): string {
  const base = adminPath(`/communications/scenarios/${scenarioKey}`);
  const params = new URLSearchParams({ tab });
  if (tab === "templates" && channel) params.set("channel", channel);
  return `${base}?${params.toString()}`;
}

export function ScenarioTabNav({
  scenarioKey,
  activeTab,
  channel,
}: {
  scenarioKey: string;
  activeTab: TabKey;
  channel?: string;
}) {
  return (
    <div className="flex gap-1 border-b border-stone-200 pb-0">
      {TABS.map(({ key, label }) => (
        <Link
          key={key}
          href={tabHref(scenarioKey, key, key === "templates" ? channel : undefined)}
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === key
              ? "border-stone-900 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-700",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
