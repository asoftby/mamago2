"use client";

import { ArrowLeft, ChevronRight, Clock, Edit3, MapPin, MoreHorizontal, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlaceHeroProps {
  title: string;
  shortDesc: string;
  logoUrl?: string | null;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  canEdit?: boolean;
  placeId: string;
  breadcrumbItems: Array<{ label: string; href?: string }>;
  address?: string;
  district?: string;
  mapsOpenUrl?: string;
  mapsDirectionsUrl?: string;
  workingHoursSummary?: string;
}

export function PlaceHero({
  title,
  shortDesc,
  logoUrl,
  imageUrl,
  rating,
  reviewCount,
  canEdit,
  placeId,
  breadcrumbItems,
  address,
  district,
  mapsOpenUrl,
  mapsDirectionsUrl,
  workingHoursSummary,
}: PlaceHeroProps) {
  const [mainTitle, subtitle] = splitTitle(title);
  const ratingLabel = rating ? `${rating.toFixed(1)} рейтинг` : null;
  const showMetrics = Boolean(ratingLabel || reviewCount);
  const addressLine = address?.trim();
  const showLocationBlock =
    Boolean(addressLine) ||
    Boolean(mapsOpenUrl || mapsDirectionsUrl) ||
    Boolean(workingHoursSummary?.trim());

  return (
    <section className="relative grid min-h-[620px] grid-cols-1 items-center gap-10 py-8 lg:min-h-[700px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
      <motion.div
        className="order-2 space-y-8 lg:order-1"
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <nav
          aria-label="Хлебные крошки"
          className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px] text-[#6B6F80]"
        >
          {breadcrumbItems.map((item, i) => {
            const isLast = i === breadcrumbItems.length - 1;
            return (
              <span key={`${item.label}-${String(i)}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#ADAFBC]" aria-hidden />}
                {!isLast && item.href ? (
                  <Link
                    href={item.href}
                    className="shrink-0 font-medium transition hover:text-[#0D1025]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "line-clamp-2 min-w-0 font-semibold text-[#303345]" : "font-medium"}>
                    {item.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <Link
          href="/places"
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-sm font-semibold text-[#6B6F80] shadow-[0_12px_40px_rgba(17,19,34,0.07)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:text-[#141625]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к списку мест
        </Link>

        <div className="space-y-5">
          <div className="space-y-3">
            <h1 className="max-w-4xl text-[32px] font-black leading-[0.95] tracking-[-0.02em] text-[#0D1025]">
              {mainTitle}
            </h1>
            {subtitle && (
              <p className="text-2xl font-black leading-tight text-[#8D92A8] sm:text-3xl lg:text-4xl">
                {subtitle}
              </p>
            )}
          </div>

          <p className="max-w-2xl text-lg leading-8 text-[#555A70] sm:text-xl">
            {shortDesc}
          </p>
        </div>

        {showLocationBlock && (
          <div className="max-w-2xl space-y-4 rounded-[24px] border border-white/70 bg-white/55 p-5 shadow-[0_18px_50px_rgba(17,19,34,0.06)] backdrop-blur-xl">
            {addressLine && (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#EF8759]" aria-hidden />
                  <div className="min-w-0 space-y-1">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8D92A8]">
                      Адрес
                    </div>
                    <p className="text-[15px] font-semibold leading-snug text-[#303345]">{addressLine}</p>
                    {district?.trim() && (
                      <p className="text-sm text-[#6B6F80]">{district.trim()}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(mapsOpenUrl || mapsDirectionsUrl) && (
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8D92A8]">
                  Как добраться
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapsOpenUrl && (
                    <a
                      href={mapsOpenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#ffd8c4] bg-white/70 px-3 text-[13px] font-semibold text-neutral-800 shadow-none transition-colors hover:bg-white"
                    >
                      Открыть в Google Картах
                    </a>
                  )}
                  {mapsDirectionsUrl && (
                    <a
                      href={mapsDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#ffd8c4] bg-white/70 px-3 text-[13px] font-semibold text-neutral-800 shadow-none transition-colors hover:bg-white"
                    >
                      Построить маршрут
                    </a>
                  )}
                </div>
              </div>
            )}

            {workingHoursSummary?.trim() && (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#EF8759]" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8D92A8]">
                      График работы
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[15px] font-semibold leading-snug text-[#303345]">
                      {workingHoursSummary.trim()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showMetrics && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {ratingLabel && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-bold text-[#303345] shadow-[0_14px_44px_rgba(108,99,255,0.11)] backdrop-blur-xl">
                <Star className="h-4 w-4 fill-[#EF8759] text-[#EF8759]" />
                {ratingLabel}
              </span>
            )}
            {reviewCount != null && reviewCount > 0 && (
              <a
                href="#reviews"
                className="text-base font-normal leading-snug text-[#555A70] decoration-[#EF8759] decoration-dashed underline underline-offset-[5px] transition hover:text-[#303345]"
              >
                {reviewCount} отзывов
              </a>
            )}
          </div>
        )}
      </motion.div>

      <motion.div
        className="relative order-1 min-h-[430px] lg:order-2 lg:min-h-[620px]"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          aria-hidden
          className="absolute -left-8 top-8 h-32 w-32 rounded-full bg-[#EF8759]/30 blur-2xl"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -right-6 bottom-24 h-40 w-40 rounded-full bg-[#6C63FF]/30 blur-2xl"
          animate={{ y: [0, -22, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="group relative h-[430px] overflow-hidden rounded-[40px] bg-[#15182E] shadow-[0_40px_120px_rgba(13,16,37,0.28)] lg:h-[620px]"
          whileHover={{ y: -6 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(239,135,89,0.55),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(108,99,255,0.55),transparent_34%),linear-gradient(135deg,#181B35,#111322)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1025]/62 via-[#0D1025]/10 to-transparent" />

          {logoUrl && (
            <div className="absolute bottom-6 left-6 rounded-full border border-white/30 bg-white/20 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-white/70 ring-1 ring-white/40 sm:h-[72px] sm:w-[72px]">
                  <Image
                    src={logoUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 72px, 64px"
                  />
                </div>
            </div>
          )}

          {canEdit && (
            <div className="absolute right-5 top-5 flex items-center gap-2">
              <Button asChild className="gap-2 rounded-full border border-white/25 bg-black/35 text-white shadow-none backdrop-blur-xl hover:bg-black/50">
                <Link href={`/editor/place/${placeId}/edit?step=1`}>
                  <Edit3 className="h-4 w-4" />
                  Редактировать
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" className="rounded-full border border-white/25 bg-black/35 text-white shadow-none backdrop-blur-xl hover:bg-black/50">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  {["Профиль", "Локация", "Контакты", "Фото", "Режим работы", "Проверка"].map((item, index) => (
                    <DropdownMenuItem asChild key={item}>
                      <Link href={`/editor/place/${placeId}/edit?step=${index + 1}`}>
                        {item}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}

function splitTitle(title: string) {
  const parts = title
    .split(/\s+[|/]\s+|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return [parts[0], parts.slice(1).join(" ")] as const;
  }

  return [title, undefined] as const;
}
