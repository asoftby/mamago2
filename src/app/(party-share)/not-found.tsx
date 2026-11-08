import Link from "next/link";

export default function UnavailablePartyProgramme() {
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-12">
    <h1 className="text-2xl font-semibold">Программа недоступна</h1>
    <p className="text-muted-foreground">Ссылка недействительна, отозвана или срок доступа истёк. Уточните актуальную ссылку у организатора.</p>
    <Link href="/" className="inline-flex min-h-11 items-center underline">На главную mamaGo</Link>
  </main>;
}
