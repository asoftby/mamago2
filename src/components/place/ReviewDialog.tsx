"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ReviewForm } from "./ReviewForm";

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
  onSuccess?: () => void;
}

export function ReviewDialog({
  isOpen,
  onClose,
  placeId,
  placeName,
  onSuccess,
}: ReviewDialogProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isClient || !isOpen) {
    return null;
  }

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return createPortal(
    <>
      {/* Full-viewport backdrop above page chrome (incl. z-50 bottom bars); portals to body */}
      <div
        role="presentation"
        className="fixed inset-0 z-[120] min-h-[100dvh] w-full touch-none overscroll-none bg-black/50 backdrop-blur-md"
        aria-hidden
        onClick={onClose}
      />

      <div
        className="fixed inset-0 z-[121] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto overscroll-contain p-4"
        role="presentation"
      >
        <div
          className="relative my-auto max-h-[min(90dvh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-2 transition-colors hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>

          <div className="p-6">
            <ReviewForm
              placeId={placeId}
              placeName={placeName}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
