"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeoGeoSelectorOption } from "@/lib/admin/seo/geo";
import { MapPin } from "lucide-react";

interface SeoGeoContextSelectorProps {
  token: string;
  breadcrumb: string;
  options: SeoGeoSelectorOption[];
}

export function SeoGeoContextSelector({
  token,
  breadcrumb,
  options,
}: SeoGeoContextSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const cities = options.filter((o) => o.group === "city");
  const regions = options.filter((o) => o.group === "region");
  const countries = options.filter((o) => o.group === "country");
  const special = options.filter((o) => o.group === "special");

  async function onChange(next: string) {
    startTransition(async () => {
      await fetch("/api/admin/seo/geo-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: next }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            SEO-контекст
          </p>
          <p className="truncate text-sm font-medium text-gray-900" title={breadcrumb}>
            {breadcrumb}
          </p>
        </div>
      </div>
      <div className="w-full sm:w-[260px]">
        <Select value={token} onValueChange={onChange} disabled={pending}>
          <SelectTrigger className="h-9 bg-white" aria-label="Выбор SEO-контекста">
            <SelectValue placeholder="Выберите контекст" />
          </SelectTrigger>
          <SelectContent>
            {special.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Обзор</SelectLabel>
                {special.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {cities.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Города</SelectLabel>
                {cities.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                    {o.group === "city" && o.regionName
                      ? ` · ${o.regionName}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {regions.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Регионы</SelectLabel>
                {regions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {countries.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Страна</SelectLabel>
                {countries.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
