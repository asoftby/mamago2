import Link from "next/link";
import { Mail, Send, Sparkles, Bell, ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";
import { listTemplates } from "@/features/email-studio/server/email-template.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCommunicationsOverviewPage() {
  const templates = await listTemplates();
  const publishedCount = templates.filter((template) => template.status === "PUBLISHED").length;

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Коммуникации"
        subtitle="Единый домен для email-канала, будущих уведомлений и delivery-инструментов."
        showBackButton={false}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle>Email Studio</CardTitle>
                <CardDescription className="max-w-2xl">
                  Управление шаблонами, preview, тестовой отправкой и версиями. Это уже готовый email-канал для будущих уведомлений.
                </CardDescription>
              </div>
              <Button asChild className="rounded-2xl">
                <Link href={adminPath("/communications/email-studio")}>
                  Открыть Email Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-stone-50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-400">
                Templates
              </div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">
                {templates.length}
              </div>
              <p className="mt-1 text-sm text-stone-500">Всего шаблонов в студии</p>
            </div>
            <div className="rounded-2xl bg-stone-50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-stone-400">
                Published
              </div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">
                {publishedCount}
              </div>
              <p className="mt-1 text-sm text-stone-500">Готовы к реальному использованию</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-emerald-600/80">
                Email channel
              </div>
              <div className="mt-2 text-base font-semibold text-emerald-900">
                Готов к MVP Notifications
              </div>
              <p className="mt-1 text-sm text-emerald-800/80">
                Preview, test send и версии уже работают
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-3xl border-stone-200/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-stone-500" />
                Notifications
              </CardTitle>
              <CardDescription>
                Следующий этап: сценарии уведомлений и правила доставки поверх email-канала.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl border-stone-200/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-stone-500" />
                Telegram
              </CardTitle>
              <CardDescription>
                Будущий канал для важных событий и быстрых напоминаний.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl border-stone-200/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-stone-500" />
                Deliveries
              </CardTitle>
              <CardDescription>
                Логи отправок, статусы и диагностика delivery-пайплайна уже доступны для MVP уведомлений.
              </CardDescription>
              <div className="pt-2">
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href={adminPath("/communications/notifications/deliveries")}>
                    Открыть deliveries
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
