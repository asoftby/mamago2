import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { OfferRevisionDecision } from "@/components/admin/offers/OfferRevisionDecision";
import { buildRevisionDiffRows, type OfferRevisionPayload } from "@/lib/offers/offerRevisionPayload";

export const dynamic = "force-dynamic";

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "— пусто —";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function OfferRevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) redirect("/login");

  const { id } = await params;
  const revision = await prisma.offerRevision.findUnique({
    where: { id },
    include: {
      offer: { include: { placements: { select: { key: true } } } },
      author: { select: { email: true, displayName: true } },
    },
  });
  if (!revision) notFound();

  const payload = revision.payload as OfferRevisionPayload;
  const rows = buildRevisionDiffRows(
    payload,
    revision.offer as unknown as Record<string, unknown>,
    {
      requestedPlacements: revision.offer.placements.map((placement) => placement.key),
      campSessionTexts: revision.offer.campSessions,
    },
  );
  const offerChangedSince =
    revision.baseOfferUpdatedAt && revision.offer.updatedAt > revision.baseOfferUpdatedAt;
  const isPending = revision.status === "PENDING";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <Link href="/admin/content/offers/revisions" className="text-sm underline underline-offset-4">
          ← К правкам
        </Link>
        <h1 className="text-2xl font-semibold">{revision.offer.title}</h1>
        <p className="text-sm text-muted-foreground">
          Автор: {revision.author?.displayName ?? revision.author?.email ?? "неизвестен"} · статус: {revision.status}
          {revision.moderatorComment ? ` · комментарий: ${revision.moderatorComment}` : ""}
        </p>
        {offerChangedSince ? (
          <p className="text-sm text-amber-700">
            Предложение менялось после того, как партнёр отправил правки (цены, расписание или контакты). Применение
            ревизии не затрагивает эти данные.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <section key={row.column} className="space-y-2 rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold capitalize">{row.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Сейчас на сайте</p>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm">{renderValue(row.before)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Предлагает партнёр</p>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-primary/5 p-3 text-sm">{renderValue(row.after)}</pre>
              </div>
            </div>
          </section>
        ))}
      </div>

      {isPending ? (
        <OfferRevisionDecision revisionId={revision.id} backHref="/admin/content/offers/revisions" />
      ) : null}
    </div>
  );
}
