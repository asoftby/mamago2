import Link from "next/link";
import { Send, ArrowRight, Bot, Bell } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCommunicationsTelegramPage() {
  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Telegram"
        subtitle="MVP-поверхность для Telegram-канала в домене коммуникаций."
        showBackButton
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <Bot className="h-5 w-5" />
            </div>
            <CardTitle>Канал Telegram</CardTitle>
            <CardDescription>
              Здесь собрана отдельная точка входа для Telegram-уведомлений: сценарии, статусы подключения и будущая диагностика.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-stone-600">
            <p>На этом этапе админка уже умеет управлять доступностью Telegram внутри notification policies.</p>
            <p>Следующий шаг — вынести сюда мониторинг bot health, delivery metrics и быстрые тестовые отправки.</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Bell className="h-5 w-5" />
            </div>
            <CardTitle>Связанные разделы</CardTitle>
            <CardDescription>
              Быстрые переходы в уже готовые поверхности домена уведомлений.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={adminPath("/communications/notifications")}>
                Открыть политики
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={adminPath("/communications/notifications/deliveries")}>
                Открыть deliveries
                <Send className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
