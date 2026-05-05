// Offer Kind Selector Component
// Step 1: Choose offer type

import { cn } from "@/lib/utils";

interface OfferKindSelectorProps {
  value: "course" | "birthday" | "service" | null;
  onChange: (value: "course" | "birthday" | "service") => void;
  disabled?: boolean;
}

const OFFER_KINDS = [
  {
    value: "course" as const,
    label: "Курс / Занятия",
    description: "Регулярные или разовые занятия для детей",
    examples: "Английский, плавание, рисование, танцы",
    icon: "📚",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    activeColor: "border-blue-500 bg-blue-100",
  },
  {
    value: "birthday" as const,
    label: "Детский праздник",
    description: "Организация дня рождения под ключ",
    examples: "Праздник в кафе, аниматоры, программа",
    icon: "🎉",
    color: "bg-purple-50 border-purple-200 hover:border-purple-400",
    activeColor: "border-purple-500 bg-purple-100",
  },
  {
    value: "service" as const,
    label: "Услуга",
    description: "Разовая услуга для праздника или мероприятия",
    examples: "Аниматор, торт, декор, фотограф",
    icon: "🎭",
    color: "bg-green-50 border-green-200 hover:border-green-400",
    activeColor: "border-green-500 bg-green-100",
  },
];

export function OfferKindSelector({
  value,
  onChange,
  disabled = false,
}: OfferKindSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Что вы предлагаете?</h2>
        <p className="text-muted-foreground">
          Выберите тип предложения для быстрого создания
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {OFFER_KINDS.map((kind) => {
          const isSelected = value === kind.value;
          
          return (
            <button
              key={kind.value}
              type="button"
              onClick={() => !disabled && onChange(kind.value)}
              disabled={disabled}
              className={cn(
                "p-6 border-2 rounded-xl text-left transition-all",
                "hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected ? kind.activeColor : kind.color
              )}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="text-5xl">{kind.icon}</div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-1">{kind.label}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {kind.description}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    Например: {kind.examples}
                  </p>
                </div>
                
                {isSelected && (
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Выбрано
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <div className="text-blue-600 mt-0.5">ℹ️</div>
          <div className="text-sm text-blue-900">
            <strong>Важно:</strong> Категория предложения будет автоматически
            унаследована от выбранного места. Отдельные категории для офферов не
            используются.
          </div>
        </div>
      </div>
    </div>
  );
}
