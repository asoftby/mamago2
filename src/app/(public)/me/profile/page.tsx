import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import { buildAdultPreferenceDisplayLine } from "@/lib/adultPersonaSignals/buildAdultPreferenceLine";
import { ChildrenCard } from "@/features/me/components/ChildrenCard";
import { childScopeFor } from "@/server/family/familyAccess";
import { loadFamilyBlockData } from "@/server/family/familyBlockData";
import { FamilyMembersCard } from "@/features/family/components/FamilyMembersCard";
import { wishlistEnabled } from "@/server/wishlist/wishlistPure";

export default async function FamilyProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/me/profile");

  const children = await prisma.child.findMany({
    where: await childScopeFor(user.id),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { systemInterests: true, customInterests: true },
  });
  const preferenceDisplayLine = await buildAdultPreferenceDisplayLine({
    preferenceSignalIds: user.preferenceSignalIds ?? [],
    leisureFormatSignalId: user.leisureFormatSignalId ?? null,
    preferenceSummary: user.preferenceSummary,
    leisureFormatSummary: user.leisureFormatSummary,
  });
  const familyView = await loadFamilyBlockData(prisma, user);
  const displayName = user.displayName?.trim() || user.email?.split("@")[0] || "Я";

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/me" className="inline-flex min-h-11 items-center text-sm text-neutral-600 hover:text-neutral-900">
        ← Мой аккаунт
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">Моя семья</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Используем профиль семьи для более точных рекомендаций и планов.
        </p>
      </header>
      <ChildrenCard
        adult={{
          displayName,
          avatarUrl: user.avatarUrl,
          initialChar: displayName.charAt(0),
          roleLabel: mapFamilyRoleToLabel(user.familyRole),
          preferenceSummary: user.preferenceSummary,
          leisureFormatSummary: user.leisureFormatSummary,
          preferenceDisplayLine,
        }}
        familyChildren={children}
      />
      {wishlistEnabled() ? (
        <Link
          href="/me/wishlists"
          className="group relative mb-5 flex min-h-24 w-full items-center gap-4 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-rose-50/70 to-amber-50 px-4 py-5 shadow-sm transition-colors hover:border-orange-200 hover:from-orange-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-6"
        >
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-orange-200/25 blur-2xl" />
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-orange-500 ring-1 ring-orange-100">
            <Gift className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-base font-semibold text-neutral-900 sm:text-lg">Списки желаний</span>
            <span className="mt-1 block text-sm text-neutral-600">Подарки на день рождения — в одном месте</span>
          </span>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-neutral-700 ring-1 ring-orange-100 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ) : null}
      {familyView ? (
        <FamilyMembersCard
          myRole={familyView.myRole}
          adults={familyView.adults}
          invites={familyView.invites}
          invitesEnabled={familyView.invitesEnabled}
          hasChildren={children.length > 0}
        />
      ) : null}
    </main>
  );
}
