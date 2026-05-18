"use client";

import { cn } from "@/lib/utils";

export function EventWhyGo({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-col", className)}>
      <h3 className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,40px)] font-normal leading-[1.05] tracking-[-0.02em] text-[#141210]" style={{ margin: "0 0 24px" }}>
        Почему <span className="italic text-[#C24E22]">стоит пойти</span>
      </h3>
      <ul className="flex flex-col gap-3.5">
        {items.map((text, i) => (
          <li
            key={i}
            className="flex items-baseline gap-3.5 text-[17px] leading-[1.5] text-[#3A332B]"
          >
            <span className="min-w-[24px] shrink-0 pt-1.5 font-mono text-[12px] text-[#C24E22]">
              0{i + 1}
            </span>
            <span dangerouslySetInnerHTML={{ __html: text }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
