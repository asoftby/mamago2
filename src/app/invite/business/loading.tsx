import { Loader2 } from "lucide-react";

export default function BusinessInviteAcceptLoading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_30%),linear-gradient(180deg,_#fffdf7_0%,_#fff_45%,_#f8fafc_100%)] px-4 py-10 text-stone-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-stone-200/80 bg-white/95 px-6 py-10 shadow-[0_30px_80px_rgba(28,25,23,0.10)] sm:px-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <Loader2 className="size-6 animate-spin" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
                Принимаем приглашение...
              </h1>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                Проверяем ссылку и готовим следующий шаг.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
