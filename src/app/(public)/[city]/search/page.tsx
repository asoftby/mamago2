"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { SearchResultItem as Result } from "@/lib/search/types";
import { SearchResultItem } from "@/components/search/SearchResultItem";

export default function CitySearchResultsPage() {
  const params = useParams<{ city: string }>();
  const queryParams = useSearchParams();
  const q = (queryParams.get("q") ?? "").trim().slice(0, 200);
  const requested = Number(queryParams.get("page") ?? "1");
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, setData] = useState<{ results: Result[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.length < 2) { return; }
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    const url = new URLSearchParams({ q, citySlug: params.city, mode: "full", page: String(page) });
    fetch(`/api/search?${url}`, { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error("Search unavailable"); return res.json(); })
      .then((response) => { if (!controller.signal.aborted) setData(response); })
      .catch(() => { if (!controller.signal.aborted) setData({ results: [], total: 0, totalPages: 1 }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, page, params.city]);
  const href = (nextPage: number) => `/${params.city}/search?${new URLSearchParams({ q, page: String(nextPage) })}`;
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Результаты поиска</h1>
      <form action={`/${params.city}/search`} className="flex gap-2">
        <input name="q" defaultValue={q} aria-label="Поисковый запрос" placeholder="Что ищем?" className="min-w-0 flex-1 rounded-xl border px-4 py-3" />
        <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-primary-foreground">Найти</button>
      </form>
      {q.length < 2 ? <p>Введите минимум два символа.</p> : null}
      {loading ? <p role="status">Ищем…</p> : null}
      {data && !loading ? (
        <>
          <p className="text-sm text-muted-foreground">Найдено: {data.total}</p>
          {data.results.length === 0 ? <p>По вашему запросу ничего не найдено.</p> : (
            <ul className="divide-y rounded-xl border p-2">
              {data.results.map((result) => (
                <li key={`${result.type}:${result.id}`}>
                  <SearchResultItem item={result} query={q} active={false} onNavigate={() => { window.location.assign(result.url); }} />
                </li>
              ))}
            </ul>
          )}
          {data.totalPages > 1 ? (
            <nav aria-label="Страницы результатов" className="flex items-center justify-center gap-5">
              {page > 1 ? <Link href={href(page - 1)}>Назад</Link> : null}
              <span>Страница {page} из {data.totalPages}</span>
              {page < data.totalPages ? <Link href={href(page + 1)}>Далее</Link> : null}
            </nav>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
