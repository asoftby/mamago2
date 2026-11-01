"use client";

import { IdeasCollections } from "@/features/ideas-collections/IdeasCollections";
import { PlanScreenHeader } from "./PlanScreenHeader";

/**
 * «Мои идеи и коллекции» прямо внутри виджета «Мой план» — вложенный экран вместо перехода на /me/ideas.
 * Шапка тот же PlanScreenHeader, что у остальных экранов плана; «Все N →» открывает список коллекций
 * в этом же экране, а «назад» из него возвращает к идеям.
 */
export function PlanIdeasScreen({
  onBack,
  onClose,
  onCountChange,
}: {
  onBack: () => void;
  onClose?: () => void;
  onCountChange?: (count: number) => void;
}) {
  return (
    <div className="h-full min-h-0 bg-[var(--mp-bg)]">
      <IdeasCollections
        layout="sheet"
        discoveryHref="/ideas"
        onBack={onBack}
        onNavigate={onClose}
        onIdeasCountChange={onCountChange}
        renderHeader={({ kicker, title, onBack: back }) => (
          <PlanScreenHeader
            kicker={kicker}
            title={title}
            onBack={back}
            onClose={onClose}
            backLabel={kicker === "Мои идеи" && title === "Коллекции" ? "Назад к идеям" : "Назад в план"}
          />
        )}
      />
    </div>
  );
}
