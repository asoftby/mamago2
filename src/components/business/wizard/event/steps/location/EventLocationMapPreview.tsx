"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { buildEventLocationLeafletMapHtml } from "./eventLocationLeafletMap";

interface EventLocationMapPreviewProps {
  lat: number | null;
  lng: number | null;
  onOpenMap: () => void;
}

export function EventLocationMapPreview({ lat, lng, onOpenMap }: EventLocationMapPreviewProps) {
  const mapDoc = useMemo(
    () => buildEventLocationLeafletMapHtml({ lat, lng }),
    [lat, lng],
  );

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-gray-300 bg-[#f0ede8]">
      <iframe
        srcDoc={mapDoc}
        className="absolute inset-0 h-full w-full border-0"
        title="Предпросмотр выбранного местоположения"
      />

      <Button
        type="button"
        onClick={onOpenMap}
        className="absolute bottom-4 right-4 rounded-full shadow-lg"
        size="sm"
        style={{ backgroundColor: "#EF8759" }}
      >
        <Maximize2 className="mr-2 h-4 w-4" />
        Открыть карту
      </Button>
    </div>
  );
}
