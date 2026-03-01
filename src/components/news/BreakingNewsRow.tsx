"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

// Arrow Icons specifically for this component
const ArrowLeft = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowRight = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

interface NewsItem {
  id: string;
  title: string;
  imageUrl: string;
  timeAgo: string;
}

interface BreakingNewsRowProps {
  items: NewsItem[];
  onAllClickHref?: string;
  className?: string;
}

export function BreakingNewsRow({ items, onAllClickHref = "#", className }: BreakingNewsRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5); // 5px tolerance
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    if (scrollerRef.current) {
      const amount = Math.round(scrollerRef.current.clientWidth * 0.8);
      scrollerRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
      // Check scroll state after animation
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <div className={cn("space-y-4 py-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Breaking News
        </h2>
        <Link 
          href={onAllClickHref} 
          className="group flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-primary hover:text-primary-foreground"
        >
           <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Left Arrow (Desktop) */}
        {canScrollLeft && (
          <div className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 -ml-4 items-center justify-center">
             <button
              onClick={() => scroll("left")}
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/70 text-white flex items-center justify-center shadow-lg transition-all active:scale-95"
              aria-label="Scroll left"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Scroll Area */}
        <div
          ref={scrollerRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href="#"
              className="relative flex-shrink-0 snap-start w-[154px] md:w-[168px] h-[224px] md:h-[238px] rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300"
            >
              {/* Background Image */}
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${item.imageUrl})` }}
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90" />
              
              {/* Content */}
              <div className="absolute inset-0 p-3 flex flex-col justify-end">
                {/* Time */}
                <span className="text-[10px] font-medium text-white/80 mb-1">
                  {item.timeAgo}
                </span>
                
                {/* Title */}
                <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-sm group-hover:text-primary-foreground/90 transition-colors">
                  {item.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>

        {/* Right Arrow (Desktop) */}
        {canScrollRight && (
          <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 -mr-4 items-center justify-center">
            <button
              onClick={() => scroll("right")}
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/70 text-white flex items-center justify-center shadow-lg transition-all active:scale-95"
              aria-label="Scroll right"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
