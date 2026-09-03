"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  buildEventLocationLeafletMapHtml,
  EVENT_LOCATION_MAP_CLICK_MESSAGE,
} from "./eventLocationLeafletMap";

interface EventLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (data: {
    lat: number;
    lng: number;
    formattedAddr?: string;
  }) => void;
  /** inline — встроенная карта без полноэкранного оверлея (редактор статьи и т.п.) */
  layout?: "fullscreen" | "inline";
}

type EventLocationMapMessage = {
  type?: string;
  lat?: number;
  lng?: number;
};

function initialPinFromProps(
  initialLat?: number | null,
  initialLng?: number | null,
): { lat: number; lng: number } | null {
  if (
    typeof initialLat !== "number" ||
    typeof initialLng !== "number" ||
    !Number.isFinite(initialLat) ||
    !Number.isFinite(initialLng)
  ) {
    return null;
  }
  return { lat: initialLat, lng: initialLng };
}

export function EventLocationMapModal({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
  layout = "fullscreen",
}: EventLocationMapModalProps) {
  const [tempPin, setTempPin] = useState<{ lat: number; lng: number } | null>(() =>
    initialPinFromProps(initialLat, initialLng),
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const mapDoc = useMemo(
    () =>
      buildEventLocationLeafletMapHtml({
        lat: initialLat,
        lng: initialLng,
        interactive: true,
      }),
    [initialLat, initialLng],
  );

  useEffect(() => {
    if (!isOpen) return;
    setTempPin(initialPinFromProps(initialLat, initialLng));
  }, [isOpen, initialLat, initialLng]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent<EventLocationMapMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== EVENT_LOCATION_MAP_CLICK_MESSAGE) return;
      if (
        typeof event.data.lat !== "number" ||
        typeof event.data.lng !== "number" ||
        !Number.isFinite(event.data.lat) ||
        !Number.isFinite(event.data.lng)
      ) {
        return;
      }

      setTempPin({ lat: event.data.lat, lng: event.data.lng });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    if (!tempPin) return;

    onConfirm({
      lat: tempPin.lat,
      lng: tempPin.lng,
    });

    toast.success("Точка выбрана на карте", {
      duration: 1500,
    });

    onClose();
  };

  if (!isOpen) return null;

  const mapFrame = (
    <iframe
      ref={iframeRef}
      srcDoc={mapDoc}
      className="h-full w-full border-0 bg-[#f0ede8]"
      title="Выбор точки на карте"
    />
  );

  if (layout === "inline") {
    return (
      <div className="flex h-[min(320px,50vh)] min-h-[220px] flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Кликните по карте, чтобы поставить метку</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Подтвердите точку снизу</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Свернуть карту"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
        <div className="min-h-0 flex-1 w-full">{mapFrame}</div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border p-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {tempPin
              ? `${tempPin.lat.toFixed(6)}, ${tempPin.lng.toFixed(6)}`
              : "Точка ещё не выбрана"}
          </p>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!tempPin}
            size="default"
            className="shrink-0 shadow-sm"
            style={{ backgroundColor: "#EF8759" }}
          >
            Подтвердить точку
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[100] flex justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div className="pointer-events-auto max-w-[min(100%,20rem)] rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:max-w-md sm:px-4">
          <p className="text-sm font-medium text-foreground">Кликните по карте, чтобы поставить метку</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tempPin
              ? `${tempPin.lat.toFixed(6)}, ${tempPin.lng.toFixed(6)}`
              : "Метка появится сразу; подтвердите, когда готово"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card/95 px-3 shadow-lg backdrop-blur-sm transition-colors hover:bg-muted sm:min-w-[7.5rem] sm:px-4"
          aria-label="Закрыть карту"
        >
          <X className="h-5 w-5 text-foreground" strokeWidth={2.25} />
          <span className="hidden text-sm font-semibold sm:inline">Закрыть</span>
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[100] flex justify-center p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!tempPin}
          size="lg"
          className="pointer-events-auto shadow-xl"
          style={{ backgroundColor: "#EF8759" }}
        >
          Подтвердить точку
        </Button>
      </div>

      <div className="min-h-0 flex-1 w-full">{mapFrame}</div>
    </div>
  );
}
