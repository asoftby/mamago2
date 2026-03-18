"use client";

import React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Link2, Send, MessageCircle, Phone, Check } from "lucide-react";
import { toast } from "sonner";
import type { MockRoute } from "@/mocks/routes.mock";
import { BUDGET_LABELS } from "@/mocks/routes.mock";
import { formatAgeKeysShort } from "@/lib/config/ages";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: MockRoute;
};

function ShareContent({ route, onClose }: { route: MockRoute; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/routes/${route.slug}`
    : `/routes/${route.slug}`;

  const ageLabel = route.ageTags.length > 0 ? formatAgeKeysShort(route.ageTags) : "";
  const shareText = `${route.title} — маршрут на ${route.stopsCount} точки в ${route.cityName}${ageLabel ? `, ${ageLabel}` : ""}. ${BUDGET_LABELS[route.budgetLevel]}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Ссылка скопирована");
  };

  const channels = [
    {
      label: "Telegram",
      icon: <Send className="w-5 h-5" />,
      color: "bg-[#2AABEE]",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "WhatsApp",
      icon: <MessageCircle className="w-5 h-5" />,
      color: "bg-[#25D366]",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
    {
      label: "Viber",
      icon: <Phone className="w-5 h-5" />,
      color: "bg-[#7360F2]",
      href: `viber://forward?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
  ];

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Preview */}
      <div className="rounded-2xl border border-neutral-100 overflow-hidden flex gap-3 p-3 bg-neutral-50">
        <img
          src={route.coverImageUrl}
          alt={route.title}
          className="w-14 h-14 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{route.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {route.cityName} · {route.stopsCount} точки
            {ageLabel ? ` · ${ageLabel}` : ""}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">{BUDGET_LABELS[route.budgetLevel]}</p>
        </div>
      </div>

      {/* Channels */}
      <div className="grid grid-cols-3 gap-3">
        {channels.map((ch) => (
          <a
            key={ch.label}
            href={ch.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 py-3 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", ch.color)}>
              {ch.icon}
            </div>
            <span className="text-xs font-medium text-neutral-700">{ch.label}</span>
          </a>
        ))}
      </div>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all",
          copied
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700"
        )}
      >
        {copied ? <Check className="w-4 h-4 shrink-0" /> : <Link2 className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-medium">{copied ? "Скопировано!" : "Скопировать ссылку"}</span>
      </button>
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
          <div className="px-5 pt-5 pb-2 border-b border-neutral-100">
            <p className="text-[15px] font-semibold text-neutral-900 text-center">Поделиться маршрутом</p>
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
        <div className="px-5 pt-2 pb-2 border-b border-neutral-100">
          <p className="text-[15px] font-semibold text-neutral-900 text-center">Поделиться маршрутом</p>
        </div>
        <SheetTitle className="sr-only">Поделиться маршрутом</SheetTitle>
        <ShareContent route={route} onClose={() => onOpenChange(false)} />
        <div className="h-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  );
}
