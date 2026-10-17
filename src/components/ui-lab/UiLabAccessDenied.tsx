import Link from "next/link";

/**
 * Rendered by the protected server layout in place of all lab content.
 * This avoids exposing demos or internal component metadata to other roles.
 */
export function UiLabAccessDenied() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-5 py-12 text-foreground">
      <span className="text-sm font-medium text-muted-foreground">mamaGo UI Lab</span>
      <h1 className="text-2xl font-semibold tracking-tight">Недостаточно прав</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Вы вошли в mamaGo, но для просмотра UI Lab нужна роль администратора
        или модератора. Проверьте, что используете нужную учётную запись на DEV.
      </p>
      <Link
        href="/me"
        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Перейти в профиль
      </Link>
    </main>
  );
}
