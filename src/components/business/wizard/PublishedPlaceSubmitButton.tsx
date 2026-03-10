"use client";

import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface PublishedPlaceSubmitButtonProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  hasChanges: boolean;
  className?: string;
}

export function PublishedPlaceSubmitButton({
  onSubmit,
  isSubmitting,
  hasChanges,
  className,
}: PublishedPlaceSubmitButtonProps) {
  return (
    <Button
      onClick={onSubmit}
      disabled={!hasChanges || isSubmitting}
      className={`bg-green-600 hover:bg-green-700 ${className || ""}`}
    >
      {isSubmitting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          Отправляем...
        </>
      ) : (
        <>
          <Send className="w-4 h-4 mr-2" />
          Отправить на модерацию
        </>
      )}
    </Button>
  );
}