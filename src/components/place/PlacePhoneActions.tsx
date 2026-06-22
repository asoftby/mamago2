"use client";

import { useState, type ReactNode } from "react";
import { Phone } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
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
  const [open, setOpen] = useState(false);

  if (phones.length === 0) return null;

  if (phones.length === 1) {
    return (
      <a href={phones[0].href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Куда позвонить?"
        headerContent={
          <div className="pr-10">
            <h3 className="text-base font-semibold text-gray-900">Куда позвонить?</h3>
            {placeTitle ? <p className="mt-1 text-sm text-gray-500">{placeTitle}</p> : null}
          </div>
        }
        height="auto"
        className="max-h-[85vh]"
      >
        <div className="p-3 sm:p-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {phones.map((phone, index) => (
              <a
                key={`${phone.href}-${index}`}
                href={phone.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-50",
                  index > 0 && "border-t border-gray-100",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{phone.label}</div>
                  <div className="mt-1 text-sm text-gray-600">{phone.value}</div>
                </div>
                <Phone className="h-5 w-5 shrink-0 text-[#E86A3A]" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
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
