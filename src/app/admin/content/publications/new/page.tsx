import { Suspense } from "react";
import { PublicationNewClient } from "@/components/admin/publications/PublicationNewClient";

function firstSearchParam(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminPublicationNewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; id?: string | string[] }>;
}) {
  const sp = await searchParams;
  const initialType = firstSearchParam(sp.type);
  const initialArticleId = firstSearchParam(sp.id);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Загрузка…</div>}>
      <PublicationNewClient initialType={initialType} initialArticleId={initialArticleId} />
    </Suspense>
  );
}
