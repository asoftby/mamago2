"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromotionPublicationType } from "@prisma/client";
import { PromotionLaunchPanel } from "./PromotionLaunchPanel";

interface PromotionLaunchModalProps {
  publicationId: string;
  publicationType: PromotionPublicationType;
  publicationTitle: string;
  publicationTypeLabel: string;
  depositBalance: number;
  depositHref: string;
  dashboardHref: string;
  /** Button content — defaults to "Продвигать" */
  children?: React.ReactNode;
  buttonClassName?: string;
}

export function PromotionLaunchModal({
  publicationId,
  publicationType,
  publicationTitle,
  publicationTypeLabel,
  depositBalance,
  depositHref,
  dashboardHref,
  children,
  buttonClassName,
}: PromotionLaunchModalProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "inline-flex items-center gap-1.5 rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
        }
      >
        {children ?? "Продвигать"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md overflow-y-auto rounded-[28px] bg-white shadow-2xl max-h-[90dvh]">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-100 px-6 py-5">
              <div>
                <p className="text-base font-semibold text-stone-950">Продвижение публикации</p>
                <p className="mt-0.5 text-sm text-stone-500">
                  Получайте лиды — платите только за действия пользователей
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <PromotionLaunchPanel
                publicationId={publicationId}
                publicationType={publicationType}
                publicationTitle={publicationTitle}
                publicationTypeLabel={publicationTypeLabel}
                depositBalance={depositBalance}
                depositHref={depositHref}
                dashboardHref={dashboardHref}
                onSuccess={handleSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
