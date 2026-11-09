"use client";

import { useId, useState, type ReactNode } from "react";
import type { CollectionCardSection } from "@/lib/article/collectionCardSections";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollectionFitBadge } from "./CollectionFitBadgeContext";

/** Shared responsive editorial card shell for events, classes, celebrations and other offers. */
export function CollectionPublicationFrame({ title, media, identity, children, description, sections = [] }: {
  title: string;
  media: ReactNode;
  identity: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  sections?: CollectionCardSection[];
}) {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const descId = useId();
  const fitLabel = useCollectionFitBadge();
  const longFitLabel = Boolean(fitLabel && fitLabel.length > 20);
  return (
    <article aria-label={title} className="not-prose overflow-hidden rounded-3xl border border-[rgba(20,18,16,.1)] bg-[#FAF7F1] p-4 font-sans text-[#141210] shadow-[0_24px_50px_-38px_rgba(20,18,16,.3)] md:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:gap-6">
        {media}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">{identity}</div>
            {fitLabel ? (
              <div className={cn("ml-auto flex min-w-0 max-w-full justify-end", longFitLabel && "basis-full")}>
                <span className="max-w-full break-words rounded-full bg-[#E0EEE5] px-3 py-1.5 text-center text-[12px] font-semibold leading-tight text-[#24563F] [overflow-wrap:anywhere]">
                  {fitLabel}
                </span>
              </div>
            ) : null}
          </div>
          <h3 className="!m-0 !text-[20px] !font-semibold !leading-[1.2] !tracking-[-0.02em] [text-wrap:balance]">{title}</h3>
          <div className="rounded-[20px] border border-[rgba(20,18,16,.1)] bg-white/50 p-4">{children}</div>
        </div>
      </div>
      {[...(description ? [{ id: "description", title: "Описание", content: description }] : []),
        ...sections.slice(0, Math.max(0, 4 - (description ? 1 : 0))).map((s) => ({
          id: s.id,
          title: s.title,
          content: <ul className="m-0 list-disc space-y-1 pl-5">{s.lines.map((line, i) => <li key={`${s.id}-${i}`}>{line}</li>)}</ul>,
        }))].map((section) => {
        const open = openSections.includes(section.id);
        return (
          <div key={section.id} className="mt-4 overflow-hidden rounded-[20px] border border-[rgba(20,18,16,.1)] bg-white/50">
            <button type="button" aria-expanded={open} aria-controls={`${descId}-${section.id}`}
              onClick={() => setOpenSections((prev) => open ? prev.filter((id) => id !== section.id) : [...prev, section.id])}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left font-sans text-[15px] font-semibold text-[#141210] transition-colors hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E86A3A]">
              {section.title}
              <Plus className={cn("size-4 text-[#6B6259] transition-transform", open && "rotate-45 text-[#C24E22]")} aria-hidden="true" />
            </button>
            {open ? <div id={`${descId}-${section.id}`} className="border-t border-[rgba(20,18,16,.1)] px-4 pb-4 pt-3 text-[14.5px] leading-relaxed text-[#3A332B]">{section.content}</div> : null}
          </div>
        );
      })}
    </article>
  );
}
