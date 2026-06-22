"use client";

import type { ReactNode } from "react";
import { CallActionButton } from "@/components/shared/CallActionButton";
import { cn } from "@/lib/utils";
import type { NormalizedPlacePhone } from "@/lib/place/placePhones";

export function PlacePhoneActionButton({
  phones,
  placeTitle,
  className,
  children,
}: {
  phones: NormalizedPlacePhone[];
  placeTitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <CallActionButton phones={phones} subtitle={placeTitle} className={className}>
      {children}
    </CallActionButton>
  );
}

export function PlacePhoneList({
  phones,
  className,
}: {
  phones: NormalizedPlacePhone[];
  className?: string;
}) {
  if (phones.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {phones.map((phone, index) => (
        <a
          key={`${phone.href}-${index}`}
          href={phone.href}
          className="block rounded-2xl border border-[#ffd8c4] bg-white/70 px-3 py-2 text-left transition-colors hover:bg-white"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C24E22]">
            {phone.label}
          </div>
          <div className="mt-1 text-sm font-medium text-neutral-900">{phone.value}</div>
        </a>
      ))}
    </div>
  );
}
