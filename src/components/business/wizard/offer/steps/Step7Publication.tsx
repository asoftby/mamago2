import type { OfferFormData } from "../types";

interface Step7PublicationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step7Publication({ data, onChange, isEditable }: Step7PublicationProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Публикация</h2>
        <p className="text-muted-foreground">
          Как клиенты будут взаимодействовать с предложением?
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          Настройки публикации будут добавлены в следующих версиях
        </p>
      </div>
    </div>
  );
}
