"use client";

import { Globe, Heart, Instagram, Phone, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";

interface PlaceSidebarCardProps {
  phone?: string;
  website?: string;
  instagramUrl?: string;
  placeName: string;
}

export function PlaceSidebarCard({
  phone,
  website,
  instagramUrl,
  placeName,
}: PlaceSidebarCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: placeName,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Implement favorite logic
  };

  const websiteHref =
    website?.trim() && /^https?:\/\//i.test(website.trim())
      ? website.trim()
      : website?.trim()
        ? `https://${website.trim().replace(/^\/+/, "")}`
        : "";

  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : "";

  const quickBtnClass =
    "h-auto min-h-10 flex-1 basis-0 flex-col gap-0.5 rounded-2xl border border-[#ffd8c4] bg-white/70 px-2 py-2 text-[11px] font-semibold text-neutral-800 shadow-none hover:bg-white [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-primary";

  return (
    <motion.div
      className="lg:sticky lg:top-28"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[34px] border border-[#ffd8c4]",
          "bg-[radial-gradient(circle_at_top_left,_rgba(255,216,196,0.42),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,181,138,0.24),_transparent_34%),linear-gradient(135deg,_#fffaf5_0%,_#fff6ef_45%,_#fff9f6_100%)]",
          "px-5 py-5 shadow-[0_28px_70px_rgba(245,140,90,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-6 sm:py-6",
        )}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-[radial-gradient(circle,_rgba(255,201,167,0.22),_transparent_68%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-12 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,170,120,0.28),_transparent_70%)] blur-3xl" />

        <div className="relative space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-lg font-black leading-snug text-neutral-900 sm:text-xl">
              Связаться с местом
            </h3>
            <p className="text-[13px] leading-[1.5] text-neutral-600">
              Уточните программу, свободные места и удобное время для первого визита.
            </p>
          </div>

          {(websiteHref || instagramUrl) ? (
            <div className="flex gap-2">
              {websiteHref ? (
                <Button
                  asChild
                  variant="ghost"
                  className={quickBtnClass}
                >
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-0.5 py-1"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Сайт
                  </a>
                </Button>
              ) : null}
              {instagramUrl ? (
                <Button
                  asChild
                  variant="ghost"
                  className={quickBtnClass}
                >
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-0.5 py-1"
                  >
                    <Instagram className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Инстаграм
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          {telHref ? (
            <a
              href={telHref}
              className={peachPrimaryCtaLinkClassName(
                "w-full justify-center px-4 py-2.5 text-[11px] sm:py-3 sm:px-[22px] sm:text-sm",
              )}
            >
              <Phone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
              Позвонить
            </a>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="h-10 rounded-xl border border-[#ffd8c4] bg-white/70 px-3 text-[13px] font-semibold text-neutral-800 shadow-none hover:bg-white"
              onClick={handleShare}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Поделиться
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-xl border border-[#ffd8c4] bg-white/70 px-3 text-[13px] font-semibold text-neutral-800 shadow-none hover:bg-white"
              onClick={handleFavorite}
            >
              <Heart
                className={`mr-1.5 h-3.5 w-3.5 ${isFavorite ? "fill-[#ff8a5b] text-[#ff8a5b]" : ""}`}
              />
              {isFavorite ? "Сохранено" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
