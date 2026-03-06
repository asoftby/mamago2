"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface PlaceDuplicateBlockProps {
  place: {
    id: string;
    title: string;
    formattedAddr: string | null;
    customAddress: string | null;
  };
  onClaimAccess: () => void;
  onContinueAsNew: () => void;
  isLoading?: boolean;
}

export function PlaceDuplicateBlock({
  place,
  onClaimAccess,
  onContinueAsNew,
  isLoading,
}: PlaceDuplicateBlockProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-amber-900 mb-1">
            Похоже, это место уже есть
          </h3>
          <p className="text-xs text-amber-700">
            Мы нашли похожее место в базе
          </p>
        </div>
      </div>

      <div className="p-3 rounded-md bg-white border border-amber-200 mb-3">
        <p className="text-sm font-medium text-gray-900">{place.title}</p>
        <p className="text-xs text-gray-600 mt-1">
          {place.formattedAddr || place.customAddress || "Адрес не указан"}
        </p>
      </div>

      <div className="space-y-2">
        <Button
          onClick={onClaimAccess}
          disabled={isLoading}
          className="w-full"
          style={{ backgroundColor: "#EF8759" }}
        >
          Это моё место — запросить доступ
        </Button>
        <Button
          onClick={onContinueAsNew}
          disabled={isLoading}
          variant="outline"
          className="w-full"
        >
          Это другое место по этому адресу
        </Button>
      </div>
    </div>
  );
}
