"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  Link2,
  MessageCircle,
  Send,
  Share2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Ограничение длины, чтобы не превысить лимит GET в браузере */
const MAX_MESSENGER_TEXT = 6500;

function clampMessengerText(text: string): string {
  if (text.length <= MAX_MESSENGER_TEXT) return text;
  return `${text.slice(0, MAX_MESSENGER_TEXT - 1)}…`;
}

type BirthdayPartyShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareTitle: string;
  shareFullText: string;
  shareUrl: string;
};

/** Как ActionRow в SaveToPlanModal: карточка с иконкой, заголовком, подзаголовком и chevron */
function ShareActionRow({
  icon,
  title,
  subtitle,
  onClick,
  href,
  iconBg = "bg-neutral-900",
  iconColor = "text-white",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  href?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  const className = cn(
    "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-left",
    "hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.985] transition-all duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
  );

  const inner = (
    <>
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 leading-tight">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-tight">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" aria-hidden />
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

export function BirthdayPartyShareModal({
  open,
  onOpenChange,
  shareTitle,
  shareFullText,
  shareUrl,
}: BirthdayPartyShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const messengerText = useMemo(() => clampMessengerText(shareFullText), [shareFullText]);

  const telegramHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set("url", shareUrl);
    p.set("text", messengerText);
    return `https://t.me/share/url?${p.toString()}`;
  }, [shareUrl, messengerText]);

  const whatsappHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set("text", messengerText);
    return `https://wa.me/?${p.toString()}`;
  }, [messengerText]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }, [shareUrl]);

  const shareViaSystem = useCallback(async () => {
    const url = shareUrl.trim();

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      toast.info(
        "Системное меню «Поделиться» в этом браузере недоступно. Откройте страницу на телефоне или воспользуйтесь Telegram или WhatsApp.",
      );
      return;
    }

    const tryShare = async (data: ShareData) => navigator.share(data);

    try {
      if (url) {
        await tryShare({ title: shareTitle, text: shareFullText, url });
      } else {
        await tryShare({ title: shareTitle, text: shareFullText });
      }
      onOpenChange(false);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }

    try {
      await tryShare({ title: shareTitle, text: shareFullText });
      onOpenChange(false);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }

    if (url) {
      try {
        await tryShare({ title: shareTitle, url });
        onOpenChange(false);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    toast.error(
      "Не удалось открыть меню «Поделиться». Попробуйте Telegram или WhatsApp выше.",
    );
  }, [shareTitle, shareFullText, shareUrl, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-md gap-0 overflow-hidden rounded-3xl border-neutral-200 p-0"
      >
        <DialogTitle className="sr-only">Поделиться планом</DialogTitle>

        <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <p className="text-[15px] font-semibold text-neutral-900 text-center leading-snug">
            Поделиться планом
          </p>
          <p className="text-xs text-neutral-500 text-center mt-1 leading-snug">
            Отправьте план в мессенджер или скопируйте ссылку
          </p>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[min(70vh,28rem)] overflow-y-auto">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest px-1">
              Мессенджеры
            </p>
            <ShareActionRow
              icon={<Send className="w-5 h-5" aria-hidden />}
              title="Telegram"
              subtitle="Открыть Telegram с текстом плана"
              href={telegramHref}
            />
            <ShareActionRow
              icon={<MessageCircle className="w-5 h-5" aria-hidden />}
              title="WhatsApp"
              subtitle="Отправить в WhatsApp"
              href={whatsappHref}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-100" />
            <span className="text-[11px] text-neutral-400">или</span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest px-1">
              Ещё
            </p>
            <ShareActionRow
              icon={<Share2 className="w-5 h-5" aria-hidden />}
              title="Поделиться через…"
              subtitle="Системное меню устройства"
              onClick={() => void shareViaSystem()}
            />
            <ShareActionRow
              icon={<Link2 className="w-5 h-5" aria-hidden />}
              title={linkCopied ? "Ссылка скопирована" : "Копировать ссылку"}
              subtitle={
                linkCopied
                  ? "Вставьте из буфера в нужный чат"
                  : "Только ссылка на страницу плана"
              }
              onClick={() => void copyLink()}
              iconBg="bg-neutral-100"
              iconColor="text-neutral-600"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
