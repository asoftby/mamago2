"use client";

import { useRouter } from "next/navigation";
import { Newspaper, FileText, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    type: "news" as const,
    title: "Быстрая новость",
    description:
      "Быстрый формат с фото, текстом и привязкой к месту/активности",
    Icon: Newspaper,
  },
  {
    type: "article" as const,
    title: "Статья",
    description: "Публикация из блоков",
    Icon: FileText,
  },
  {
    type: "collection" as const,
    title: "Подборка",
    description: "SEO-страница с вводным текстом и динамической выдачей",
    Icon: Layers,
  },
];

export function PublicationTypePicker({
  onPicked,
  className,
}: {
  /** Если задан — вызывается вместо навигации (например, из модалки) */
  onPicked?: (type: (typeof OPTIONS)[number]["type"]) => void;
  className?: string;
}) {
  const router = useRouter();

  const go = (type: (typeof OPTIONS)[number]["type"]) => {
    if (onPicked) {
      onPicked(type);
      return;
    }
    if (type === "article") {
      router.push("/admin/content/articles/new");
      return;
    }
    router.push(`/admin/content/publications/new?type=${type}`);
  };

  return (
    <div className={cn("grid gap-3 sm:grid-cols-1", className)}>
      {OPTIONS.map(({ type, title, description, Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => go(type)}
          className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 hover:border-gray-300"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-gray-900">{title}</span>
            <span className="mt-1 block text-sm text-gray-600">{description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
