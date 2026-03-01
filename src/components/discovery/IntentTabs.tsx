"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { INTENT_FILTERS, DEFAULT_INTENT } from "@/server/discovery/intentConfig";

type Intent = keyof typeof INTENT_FILTERS;

const INTENTS: { id: Intent; label: string }[] = [
  { id: "go", label: "Куда пойти" },
  { id: "classes", label: "Занятия" },
  { id: "birthday", label: "День рождения" },
  // { id: "journal", label: "Журнал" }, // Можно добавить позже
];

export function IntentTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentIntent = (searchParams.get("intent") as Intent) || DEFAULT_INTENT;

  const handleIntentChange = (newIntent: Intent) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("intent", newIntent);
    
    // При смене интента можно сбрасывать фильтры, если они не совместимы,
    // но пока оставляем как есть, чтобы не усложнять UX "прыганием".
    // Или можно делать soft reset: params.forEach((v, k) => k !== 'intent' && params.delete(k));
    
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {INTENTS.map((intent) => (
        <button
          key={intent.id}
          onClick={() => handleIntentChange(intent.id)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
            currentIntent === intent.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {intent.label}
        </button>
      ))}
    </div>
  );
}
