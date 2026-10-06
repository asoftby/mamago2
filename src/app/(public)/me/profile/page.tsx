import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import { buildAdultPreferenceDisplayLine } from "@/lib/adultPersonaSignals/buildAdultPreferenceLine";
import { ChildrenCard } from "@/features/me/components/ChildrenCard";
import { childScopeFor } from "@/server/family/familyAccess";
import { familyInvitesEnabled, familyReadsEnabled } from "@/server/family/familyScope";
import { listFamilyForUser } from "@/server/family/familyMembers.service";
import { FamilyMembersCard } from "@/features/family/components/FamilyMembersCard";

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
  const reads = familyReadsEnabled();
  const invitesEnabled = familyInvitesEnabled();
  const family = reads ? await listFamilyForUser(prisma, user.id) : null;
  // Lazy family: a user without a family row can still invite (the family is created on first invite).
  const soloFallback =
    reads && invitesEnabled && !family
      ? { myRole: "OWNER" as const, adults: [{ userId: user.id, displayName: user.displayName ?? null, role: "OWNER" as const, isMe: true }], invites: [] as Array<{ id: string; createdAt: Date }> }
      : null;
  const familyView = family ?? soloFallback;
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
      {familyView ? (
        <FamilyMembersCard
          myRole={familyView.myRole}
          adults={familyView.adults.map((a) => ({
            userId: a.userId,
            displayName: a.displayName,
            role: a.role,
            isMe: a.isMe,
          }))}
          invites={familyView.invites.map((i) => ({ id: i.id, createdAt: i.createdAt.toISOString() }))}
          invitesEnabled={invitesEnabled}
          hasChildren={children.length > 0}
        />
      ) : null}
    </main>
  );
}
