"use client";

import { DemoSection } from "../_components/DemoSection";
import { Button } from "@/components/ui/button";
import {
  LiquidNotification,
  type LiquidNotificationVariant,
} from "@/components/ui/liquid-notification";
import { toast } from "@/lib/toast";

const VARIANTS: LiquidNotificationVariant[] = [
  "success",
  "error",
  "warning",
  "info",
  "brand",
];

export function LiquidNotificationsSection() {
  return (
    <DemoSection
      id="liquid-notifications"
      title="Liquid notifications"
      description="Статичные превью и живые toasts (Sonner + LiquidNotification). Только dev UI Lab."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {VARIANTS.map((variant) => (
          <div key={variant} className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {variant}
            </p>
            <LiquidNotification
              variant={variant}
              title="Пример заголовка"
              description="Краткое описание под заголовком."
              onClose={() => {}}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const titles: Record<LiquidNotificationVariant, string> = {
                  success: "Событие удалено из плана",
                  error: "Не получилось выполнить действие",
                  warning: "Проверьте данные",
                  info: "Напоминание о событии",
                  brand: "Новое сообщение",
                };
                if (variant === "success") {
                  toast.success(titles.success, {
                    description: "Можно добавить вторую строку.",
                  });
                } else if (variant === "error") {
                  toast.error(titles.error);
                } else if (variant === "warning") {
                  toast.warning(titles.warning);
                } else if (variant === "info") {
                  toast.info(titles.info);
                } else {
                  toast.message(titles.brand);
                }
              }}
            >
              Показать toast
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          С действием (кнопка не закрывает превью)
        </p>
        <LiquidNotification
          variant="success"
          title="Событие удалено из плана"
          description="Пока без реального undo на сервере."
          actionLabel="Отменить"
          onAction={() => {}}
          onClose={() => {}}
        />
        <p className="text-xs text-muted-foreground">
          {/* TODO: подключить реальный undo, когда появится API */}
          TODO: серверный undo для удаления из плана — затем вызывать onAction.
        </p>
      </div>
    </DemoSection>
  );
}
