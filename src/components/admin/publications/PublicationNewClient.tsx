"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { BackButton } from "@/components/admin/BackButton";
import {
  NewsPublicationEditor,
  CollectionPublicationEditor,
} from "@/components/admin/publications/PublicationTypeEditors";
import { PublicationTypePicker } from "@/components/admin/publications/PublicationTypePicker";

const TITLES: Record<string, string> = {
  news: "Новая Breaking News",
  article: "Новая статья",
  collection: "Новая подборка",
};

const SUBTITLES: Record<string, string> = {
  news: "Breaking news · короткий формат",
  collection: "Foundation UI · без сохранения на сервер",
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
  }, [type, router]);

  if (!valid) {
    return (
      <div className="p-6 md:p-4 space-y-6 max-w-lg">
        <div className="flex items-center gap-3">
          <BackButton href="/admin/content/publications" />
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Тип публикации</h1>
        </div>
        <p className="text-sm text-gray-600">
          Выберите формат. Статьи и Breaking news сохраняются в БД; подборки — foundation.
        </p>
        <PublicationTypePicker />
      </div>
    );
  }

  if (type === "article") {
    return (
      <div className="p-6 text-sm text-gray-500">Переход к редактору статьи…</div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-8">
      <div className="flex max-w-3xl items-start gap-3">
        <BackButton href="/admin/content/publications" />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-xl font-bold text-gray-900 min-w-0 break-words">
            {type === "news"
              ? newsTitle.trim() || TITLES.news
              : TITLES[type] ?? "Публикация"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {SUBTITLES[type] ?? "Foundation UI · без сохранения на сервер"}
          </p>
        </div>
      </div>
      {type === "news" && (
        <NewsPublicationEditor articleId={articleId} title={newsTitle} onTitleChange={setNewsTitle} />
      )}
      {type === "collection" && <CollectionPublicationEditor />}
    </div>
  );
}
