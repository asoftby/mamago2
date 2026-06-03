"use client";

import React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Link2, Send, Share2, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PublicRouteCardModel } from "@/components/routes/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: PublicRouteCardModel;
};

function ShareContent({
  route,
  onClose,
}: {
  route: PublicRouteCardModel;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/routes/${route.slug}`
      : `/routes/${route.slug}`;

  const minAge =
    route.ageTags.length > 0
      ? Math.min(
          ...route.ageTags.map((tag) => parseInt(tag.split("-")[0] ?? "0", 10)),
        )
      : null;
  const ageLabel = minAge !== null ? `${minAge}+` : null;

  const subtitle = [
    route.cityName,
    ageLabel,
    `${route.stopsCount} точки`,
    route.budgetLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const shareText = `${route.title} — ${subtitle}`;

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: route.title, text: shareText, url });
    } catch {
      // user cancelled — ignore
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement("input");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const btnBase =
    "w-full flex items-center gap-3 px-4 h-13 py-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 transition-all text-sm font-medium";

  return (
    <div className="px-5 py-5 space-y-4">
      {/* Preview */}
      <div className="rounded-2xl border border-neutral-100 overflow-hidden flex items-center gap-3 p-3 bg-neutral-50">
        <img
          src={route.coverImageUrl}
          alt={route.title}
          className="w-14 h-14 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm font-semibold text-neutral-900 line-clamp-1">
            Маршрут «{route.title}»
          </p>
          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {/* Telegram */}
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btnBase}
        >
          <span className="w-8 h-8 rounded-xl bg-[#2AABEE] flex items-center justify-center text-white shrink-0">
            <Send className="w-4 h-4" />
          </span>
          Поделиться в Telegram
        </a>

        {/* Native share */}
        {hasNativeShare && (
          <button onClick={handleNativeShare} className={btnBase}>
            <span className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white shrink-0">
              <Share2 className="w-4 h-4" />
            </span>
            Поделиться через...
          </button>
        )}

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className={cn(
            btnBase,
            copied &&
              "border-green-200 bg-green-50 text-green-700 hover:border-green-200",
          )}
        >
          <span
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0",
              copied ? "bg-green-500" : "bg-neutral-900",
            )}
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
          </span>
          {copied ? "Скопировано!" : "Скопировать ссылку"}
        </button>
      </div>
    </div>
  );
}

export function ShareSheet({ open, onOpenChange, route }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200">
          <DialogTitle className="sr-only">Поделиться маршрутом</DialogTitle>
          <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
            <p className="text-[15px] font-semibold text-neutral-900 text-center">
              Поделиться маршрутом
            </p>
          </div>
          <ShareContent route={route} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full rounded-t-3xl bg-white border-t border-neutral-100 shadow-2xl p-0 gap-0"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-200" />
        </div>
        <div className="px-5 pt-2 pb-3 border-b border-neutral-100">
          <p className="text-[15px] font-semibold text-neutral-900 text-center">
            Поделиться маршрутом
          </p>
        </div>
        <SheetTitle className="sr-only">Поделиться маршрутом</SheetTitle>
        <ShareContent route={route} onClose={() => onOpenChange(false)} />
        <div className="h-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  );
}
