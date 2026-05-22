"use client";

import { cn } from "@/lib/utils";

export function EventGoodFit({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-col", className)}>
      <h3 className="font-sans text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.02em] text-[#141210]" style={{ margin: "0 0 24px" }}>
        Кому <span className="italic text-[#C24E22]">подойдёт</span>
      </h3>
      <ul className="flex flex-col gap-3.5">
        {items.map((text, i) => (
          <li
            key={i}
            className="flex items-baseline gap-3.5 text-[17px] leading-[1.5] text-[#3A332B]"
          >
            <span className="min-w-[20px] shrink-0 pt-1 text-[18px] leading-none text-[#E86A3A]">
              ✦
            </span>
            <span dangerouslySetInnerHTML={{ __html: text }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
