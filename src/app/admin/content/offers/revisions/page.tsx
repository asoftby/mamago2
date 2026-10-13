import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { describeContentColumns } from "@/lib/offers/offerPublishedEditGate";

export const dynamic = "force-dynamic";

/** Очередь правок опубликованных офферов: контент, который партнёр изменил и который ждёт решения. */
export default async function OfferRevisionsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) redirect("/login");

  const revisions = await prisma.offerRevision.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      changedFields: true,
      createdAt: true,
      offer: { select: { id: true, title: true, place: { select: { title: true } } } },
      author: { select: { email: true, displayName: true } },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Правки опубликованных предложений</h1>
          <p className="text-sm text-muted-foreground">
            Текст, фото, категории и другие данные карточки, изменённые партнёром. Живая версия остаётся прежней до решения.
          </p>
        </div>
        <Link href="/admin/content/offers" className="text-sm underline underline-offset-4">
          К предложениям
        </Link>
      </div>

      {revisions.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Ожидающих правок нет.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {revisions.map((revision) => (
            <li key={revision.id}>
              <Link
                href={`/admin/content/offers/revisions/${revision.id}`}
                className="flex flex-col gap-1 p-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{revision.offer.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {revision.offer.place?.title ?? "Без места"} · {describeContentColumns(revision.changedFields)}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {revision.author?.displayName ?? revision.author?.email ?? "Автор неизвестен"} ·{" "}
                  {formatDistanceToNow(revision.createdAt, { addSuffix: true, locale: ru })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
