import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoEmptyState } from "./primitives/SeoEmptyState";

export function SeoPagesEmptyState() {
  return (
    <SeoEmptyState
      icon={<FileStack className="h-7 w-7 text-gray-400" aria-hidden />}
      title="Пока нет SEO-посадок"
      description="Здесь будут preset-страницы, категорийные посадки и сгенерированные индексируемые URL. Это отдельный слой от карточек событий и мест."
      action={
        <Button type="button" variant="outline" disabled>
          Создать SEO Page
        </Button>
      }
      footer="Подключение создания и API — в следующих итерациях"
    />
  );
}
