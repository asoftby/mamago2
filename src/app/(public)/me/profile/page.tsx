import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import { buildAdultPreferenceDisplayLine } from "@/lib/adultPersonaSignals/buildAdultPreferenceLine";
import { ChildrenCard } from "@/features/me/components/ChildrenCard";
import { childScopeFor } from "@/server/family/familyAccess";

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
    </main>
  );
}
