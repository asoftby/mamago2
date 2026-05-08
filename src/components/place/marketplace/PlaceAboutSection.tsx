"use client";

import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { cn } from "@/lib/utils";
import { Phone, Globe, Instagram, Facebook, Youtube, Send } from "lucide-react";
import Link from "next/link";

interface PlaceAboutSectionProps {
  description: string;
  phone?: string;
  website?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  vkUrl?: string;
  youtubeUrl?: string;
  telegramUrl?: string;
  tiktokUrl?: string;
  yearFounded?: number;
  ageRange?: string;
  format?: string;
  categories?: string[];
}

export function PlaceAboutSection({
  description,
  phone,
  website,
  instagramUrl,
  facebookUrl,
  vkUrl,
  youtubeUrl,
  telegramUrl,
  tiktokUrl,
  yearFounded,
  ageRange,
  format,
  categories,
}: PlaceAboutSectionProps) {
  const socialLinks = [
    { url: instagramUrl, icon: Instagram, label: "Instagram", color: "#E4405F" },
    { url: facebookUrl, icon: Facebook, label: "Facebook", color: "#1877F2" },
    { url: vkUrl, icon: Send, label: "VK", color: "#0077FF" },
    { url: youtubeUrl, icon: Youtube, label: "YouTube", color: "#FF0000" },
    { url: telegramUrl, icon: Send, label: "Telegram", color: "#0088CC" },
    { url: tiktokUrl, icon: Send, label: "TikTok", color: "#000000" },
  ].filter((link) => link.url);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">О месте</h2>

      {/* Description — RichContentRenderer avoids invalid <p><p> nesting and applies paragraph spacing */}
      {description.trim().length > 0 && (
        <RichContentRenderer
          html={description}
          className={cn(
            "prose-gray max-w-none",
            "text-base leading-relaxed text-gray-700",
            "prose-p:text-base prose-p:leading-relaxed prose-p:text-gray-700 prose-p:my-5 [&>p:last-child]:mb-0",
            "prose-headings:text-gray-900 prose-strong:text-gray-900",
            "[&>p:first-child]:mt-0",
          )}
        />
      )}

      {/* Key Characteristics */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        {ageRange && (
          <InfoRow label="Возраст" value={ageRange} />
        )}
        {format && (
          <InfoRow label="Формат" value={format} />
        )}
        {categories && categories.length > 0 && (
          <InfoRow label="Направления" value={categories.join(", ")} />
        )}
        {yearFounded && (
          <InfoRow label="Год основания" value={yearFounded.toString()} />
        )}
        {website && (
          <div className="flex items-start gap-3 border-t border-gray-200 pt-3">
            <Globe className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-500">Сайт</div>
              <Link
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-[#EF8759] hover:underline"
              >
                {website.replace(/^https?:\/\//, "")}
              </Link>
            </div>
          </div>
        )}
        {phone && (
          <div className="flex items-start gap-3 border-t border-gray-200 pt-3">
            <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-500">Телефон</div>
              <Link
                href={`tel:${phone}`}
                className="text-base text-[#EF8759] hover:underline"
              >
                {phone}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Social Media */}
      {socialLinks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Мы в социальных сетях
          </h3>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200"
                  aria-label={link.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className="text-base text-gray-900">{value}</div>
      </div>
    </div>
  );
}
