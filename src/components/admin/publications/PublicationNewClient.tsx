"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { NewsPublicationEditor } from "@/components/admin/publications/PublicationTypeEditors";
import { PublicationTypePicker } from "@/components/admin/publications/PublicationTypePicker";

const TITLES: Record<string, string> = {
  news: "Новая Breaking News",
  article: "Новая статья",
  collection: "Новая подборка",
};

const SUBTITLES: Record<string, string> = {
  news: "Breaking news · короткий формат",
};

export function PublicationNewClient({
  initialType,
  initialArticleId,
}: {
  /** Снимок query с сервера — совпадает с первым проходом гидрации (без рассинхрона с useSearchParams). */
  initialType: string | null;
  initialArticleId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const type = (hydrated ? (searchParams.get("type") ?? initialType) : initialType) ?? null;
  const articleId = (hydrated ? (searchParams.get("id") ?? initialArticleId) : initialArticleId) ?? null;
  const valid = type === "news" || type === "article" || type === "collection";
  const [newsTitle, setNewsTitle] = useState("");

  useEffect(() => {
    if (type === "article") {
      router.replace("/admin/content/articles/new");
    }
    // Подборка — публикация журнала типа COLLECTION в редакторе статьи.
    if (type === "collection") {
      router.replace("/admin/content/articles/new?type=collection");
    }
  }, [type, router]);

  if (!valid) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-lg">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Тип публикации</h1>
        </div>
        <p className="text-sm text-gray-600">
          Выберите формат публикации журнала.
        </p>
        <PublicationTypePicker />
      </div>
    );
  }

  if (type === "article" || type === "collection") {
    return (
      <div className="p-6 text-sm text-gray-500">Переход к редактору статьи…</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div className="max-w-3xl">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-xl font-bold text-gray-900 min-w-0 break-words">
            {type === "news"
              ? newsTitle.trim() || TITLES.news
              : TITLES[type] ?? "Публикация"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {SUBTITLES[type] ?? ""}
          </p>
        </div>
      </div>
      {type === "news" && (
        <NewsPublicationEditor articleId={articleId} title={newsTitle} onTitleChange={setNewsTitle} />
      )}
    </div>
  );
}
