import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

/** Чип факта (возраст, место, цена) — одинаковый для всех участников подборки. */
export function CollectionChip({ icon, children, strong }: { icon?: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13.5px] " +
        (strong ? "border-[#141210] font-semibold text-[#141210]" : "border-[rgba(20,18,16,.18)] text-[#3A332B]")
      }
    >
      {icon ? <span className="shrink-0 text-[#6B6259] [&>svg]:size-3.5">{icon}</span> : null}
      {children}
    </span>
  );
}

export function CollectionRating({ value, count }: { value: number | null | undefined; count: number | null | undefined }) {
  if (!count || !value) {
    return (
      <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(20,18,16,.18)] px-2.5 text-[13px] font-semibold text-[#3A332B]">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Новое на mamaGo
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-baseline gap-2 text-[15px]">
      <b className="font-bold text-[#141210]">
        <span className="text-[#E86A3A]">★</span> {String(value.toFixed(1)).replace(".", ",")}
      </b>
      <i className="text-[13.5px] not-italic text-[#6B6259]">{count} на mamaGo</i>
    </span>
  );
}

/** Голос бизнеса — цитата на белой подложке с подписью «Площадка о себе». */
export function CollectionVenueQuote({ text }: { text: string }) {
  return (
    <figure className="m-0 mt-3.5 rounded-2xl border border-[rgba(20,18,16,.1)] bg-white px-3.5 pb-3.5 pt-3">
      <figcaption className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[.12em] text-[#6B6259]">Площадка о себе</figcaption>
      <blockquote className="m-0 text-base font-semibold leading-snug text-[#141210]">«{text}»</blockquote>
    </figure>
  );
}

/** Ограничения не прячем: пунктирная рамка «Учтите». */
export function CollectionNote({ text }: { text: string }) {
  return (
    <div className="mt-2.5 flex items-start gap-2.5 rounded-[14px] border border-dashed border-[rgba(20,18,16,.18)] px-3 py-2.5 text-sm leading-snug text-[#3A332B]">
      <span>
        <b className="mr-2 font-mono text-[10.5px] font-normal uppercase tracking-[.12em] text-[#C24E22]">Учтите</b>
        {text}
      </span>
    </div>
  );
}
