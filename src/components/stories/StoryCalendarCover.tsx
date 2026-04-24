"use client";

import Image from "next/image";

type Props = {
  title: string;
  main: string | number;
  sub: string;
  onClick?: () => void;
};

export function StoryCalendarCover({ title, main, sub, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-square w-[87px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[28px] bg-[#F5F7FB] transition-transform duration-200 hover:scale-[1.04] md:w-[104px]"
      aria-label={title}
    >
      <div className="absolute left-4 top-4 z-10 text-sm font-black text-[#1D2430]">
        {title}
      </div>

      <Image
        src="/uploads/today.webp"
        alt=""
        width={320}
        height={320}
        className="h-[72%] w-[72%] object-contain transition-transform duration-300 group-hover:scale-105"
      />

      <div className="pointer-events-none absolute flex flex-col items-center justify-center pt-12">
        <div className="text-[38px] font-black leading-none text-[#1D2430] md:text-[48px]">
          {main}
        </div>
        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#EF8759] md:text-xs">
          {sub}
        </div>
      </div>
    </button>
  );
}
