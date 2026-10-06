import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { familyInvitesEnabled } from "@/server/family/familyScope";
import {
  FAMILY_CONSENT_TEXT,
  FAMILY_CONSENT_TEXT_VERSION,
  familyConsentConfigured,
} from "@/server/family/familyConsent";
import { getFamilyInviteInfo } from "@/server/family/familyJoin.service";
import { inviterTitle } from "@/features/family/lib/familyJoinView";
import { FamilyJoinClient } from "@/features/family/components/FamilyJoinClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Приглашение в семью", robots: { index: false, follow: false } };

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-[60vh] w-full max-w-xl px-4 py-12">{children}</main>;
}

export default async function FamilyInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!familyInvitesEnabled()) notFound();
  const token = (await searchParams).token?.trim();

  const invalid = (
    <Shell>
      <h1 className="text-2xl font-semibold text-neutral-950">Ссылка недействительна</h1>
      <p className="mt-2 text-neutral-600">Её уже использовали или отозвали. Попросите прислать новую.</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-sm underline">На главную</Link>
    </Shell>
  );
  if (!token) return invalid;
  const info = await getFamilyInviteInfo(prisma, token);
  if (!info) return invalid;

  if (!familyConsentConfigured()) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-neutral-950">{inviterTitle(info.inviterName)}</h1>
        <p className="mt-2 text-neutral-600">Присоединение к семье пока недоступно. Загляните сюда чуть позже.</p>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  const returnTo = `/invite/family?token=${encodeURIComponent(token)}`;
  if (!user) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-neutral-950">{inviterTitle(info.inviterName)}</h1>
        <p className="mt-2 text-neutral-600">
          Вместе вы будете видеть детей и общие планы на mamaGo. Личные записи остаются личными. Войдите или зарегистрируйтесь, чтобы продолжить.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={buildAuthUrl({ mode: "login", redirectTo: returnTo })}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white"
          >
            Войти
          </Link>
          <Link
            href={buildAuthUrl({ mode: "register", redirectTo: returnTo })}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 px-5 text-sm font-medium text-neutral-900"
          >
            Зарегистрироваться
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold text-neutral-950">{inviterTitle(info.inviterName)}</h1>
      <FamilyJoinClient
        token={token}
        consentVersion={FAMILY_CONSENT_TEXT_VERSION}
        consentText={[...FAMILY_CONSENT_TEXT]}
      />
    </Shell>
  );
}
