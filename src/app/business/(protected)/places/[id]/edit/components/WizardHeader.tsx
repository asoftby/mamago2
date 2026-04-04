import { ContentStatus } from "@prisma/client";
import { Check, Loader2 } from "lucide-react";

interface WizardHeaderProps {
  currentStep: number;
  totalSteps: number;
  status: ContentStatus;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function WizardHeader({
  currentStep,
  totalSteps,
  status,
  isSaving,
  lastSaved,
}: WizardHeaderProps) {
  const progress = (currentStep / totalSteps) * 100;

  const statusLabels: Record<ContentStatus, string> = {
    DRAFT: "Черновик",
    PENDING: "На модерации",
    PENDING_UPDATE: "На проверке",
    PUBLISHED: "Опубликовано",
    NEEDS_REVISION: "Требует изменений",
    REJECTED: "Отклонено",
    DELETED: "Удалено",
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Создание места</h1>
            <span className="text-sm text-muted-foreground">
              {statusLabels[status]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Сохраняю...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">
                  Сохранено {formatTime(lastSaved)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {currentStep}/{totalSteps}
          </span>
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-3 text-xs text-muted-foreground">
          <span className={currentStep === 1 ? "font-medium text-foreground" : ""}>
            Профиль
          </span>
          <span className={currentStep === 2 ? "font-medium text-foreground" : ""}>
            Локация
          </span>
          <span className={currentStep === 3 ? "font-medium text-foreground" : ""}>
            Фото
          </span>
          <span className={currentStep === 4 ? "font-medium text-foreground" : ""}>
            Контакты
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "только что";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
