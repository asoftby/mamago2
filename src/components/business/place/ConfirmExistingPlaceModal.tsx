"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";

interface ConfirmExistingPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  onAddNewPlace: () => void; // Callback to open unit-flow
}

type PlaceDetails = {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  placeKind: string;
  logoImageId: string | null;
};

export function ConfirmExistingPlaceModal({
  isOpen,
  onClose,
  placeId,
  onAddNewPlace,
}: ConfirmExistingPlaceModalProps) {
  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && placeId) {
      loadPlaceDetails();
    }
  }, [isOpen, placeId]);

  const loadPlaceDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/business/places/${placeId}`);

      if (!response.ok) {
        throw new Error("Failed to load place details");
      }

      const data = await response.json();
      setPlace(data.place);
    } catch (err) {
      console.error("[ConfirmExistingPlaceModal] Load error:", err);
      setError("Не удалось загрузить данные места");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRequest = async () => {
    setIsClaiming(true);
    setError(null);

    try {
      const response = await fetch(`/api/business/places/${placeId}/claim`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit claim request");
      }

      setClaimSuccess(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        setClaimSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("[ConfirmExistingPlaceModal] Claim error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка отправки запроса"
      );
    } finally {
      setIsClaiming(false);
    }
  };

  const handleAddNewPlace = () => {
    onClose();
    onAddNewPlace();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Это ваше место?</DialogTitle>
          <DialogDescription>
            Если место уже добавлено кем-то ранее, вы можете запросить права на
            управление. Если это другое место по этому адресу
            (павильон/офис/внутри ТЦ) — добавьте новое.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && place && (
          <div className="py-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900">{place.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {place.formattedAddr || place.customAddress || "Адрес не указан"}
              </p>
              {place.placeKind && place.placeKind !== "STANDALONE" && (
                <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                  {place.placeKind === "COMPLEX" ? "Комплекс" : "Юнит"}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {claimSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700">
              Запрос отправлен на модерацию
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleClaimRequest}
            disabled={isLoading || isClaiming || claimSuccess}
            className="w-full"
          >
            {isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Да, это моё — запросить доступ
          </Button>

          <Button
            variant="outline"
            onClick={handleAddNewPlace}
            disabled={isLoading || isClaiming || claimSuccess}
            className="w-full"
          >
            Нет, это другое — добавить новое здесь
          </Button>

          {place && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="w-full"
            >
              <a
                href={`/business/places/${placeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                Перейти к месту
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
