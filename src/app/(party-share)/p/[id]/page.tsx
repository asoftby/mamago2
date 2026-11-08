import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublicPartyProgramme } from "@/server/birthday/partyPlan.service";
import { BirthdayPartyDayPlan } from "@/features/me/components/BirthdayPartyDayPlan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Программа праздника", robots: {
  index: false, follow: false, noarchive: true, nosnippet: true,
}, referrer: "no-referrer" };
export default async function PublicBirthdayPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const programme = await readPublicPartyProgramme(id);
  if (!programme) notFound();
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold">mamaGo</Link>
    <h1 className="font-editorial text-3xl">Праздник</h1>
    <p className="text-sm text-muted-foreground">Просмотр программы. Информация может измениться.</p>
    <BirthdayPartyDayPlan programme={programme} />
  </main>;
}
