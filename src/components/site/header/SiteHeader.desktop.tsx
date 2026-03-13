"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { cn } from "@/lib/utils";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { getIntentFromPath, getCityFromPath } from "@/lib/intent";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";

export function SiteHeaderDesktop() {
  const pathname = usePathname();
  const isScrolled = useHeaderScrolled(80); // Enter compact at 80px
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedRef = useRef(false);
  
  // Extract current intent and city from URL
  const currentIntent = getIntentFromPath(pathname);
  const currentCity = getCityFromPath(pathname);
  
  // Check if we're on an intent page that should show filters
  const shouldShowFilters = currentIntent && currentCity;

  // Update ref when state changes
  useEffect(() => {
    expandedRef.current = isExpanded;
  }, [isExpanded]);

  // Reset expanded state when scrolling to top
  useEffect(() => {
    if (!isScrolled) {
      setIsExpanded(false);
    }
  }, [isScrolled]);

  // Collapse on scroll delta when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const initialScrollY = window.scrollY;
    const scrollThreshold = window.innerHeight * 0.1;

    const handleScroll = () => {
      if (!expandedRef.current) return;
      
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - initialScrollY);
      
      if (scrollDelta > scrollThreshold) {
        setIsExpanded(false);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 300);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isExpanded]);

  // Collapse on click outside header
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const header = document.querySelector('header');
      
      if (header && !header.contains(target)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Determine header state
  const isCompact = isScrolled && !isExpanded;
  const isFull = !isScrolled || isExpanded;

  return (
    <>
      {/* ============================================ */}
      {/* OUTER STICKY SHELL - Only this changes height */}
      {/* ============================================ */}
      <header 
        className={cn(
          "sticky top-0 z-50 w-full bg-white border-b border-gray-200",
          "transition-shadow duration-250 ease-out",
          isScrolled ? "shadow-md" : "shadow-sm"
        )}
      >
      <div className="mx-auto w-full max-w-[1200px] px-4">
        {/* Height-Controlled Container */}
        <div 
          className={cn(
            "relative overflow-hidden transition-[height] duration-250 ease-out",
            isFull ? "h-[230px]" : "h-[95px]"
          )}
        >
          {/* ============================================ */}
          {/* HEADER GRID - 3 Column Layout */}
          {/* Left: Stable Anchor | Center: Animated Stage | Right: Stable Anchor */}
          {/* ============================================ */}
          <div 
            className={cn(
              "grid transition-[grid-template-rows,gap,padding] duration-250 ease-out",
              "grid-cols-[auto_minmax(0,1fr)_auto]",
              isFull 
                ? "grid-rows-[auto_auto] gap-y-6 pt-8 pb-6" 
                : "grid-rows-[auto] gap-y-0 pt-4 pb-0"
            )}
          >
            {/* ============================================ */}
            {/* ROW 1 - Main Navigation Row */}
            {/* ============================================ */}
            
            {/* LEFT ANCHOR - Stable, never animates */}
            <div className="flex items-center gap-3">
              <Link href="/minsk" className="hover:opacity-80 transition-opacity">
                <Image
                  src="/favico_mamago.webp"
                  alt="MamaGo"
                  width={100}
                  height={100}
                  priority
                  className="w-auto h-[39px]"
                />
              </Link>
              
              <Link
                href="/minsk"
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Глобальный поиск"
              >
                <Search className="h-5 w-5 text-gray-600" />
              </Link>
            </div>

            {/* CENTER STAGE - Only animated area */}
            <div className="relative flex items-center justify-center min-h-[60px]">
              {/* Layer 1: Intent Tabs - Slides up and fades out */}
              <div 
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "transition-[opacity,transform] duration-250 ease-out",
                  "will-change-[transform,opacity]",
                  isFull 
                    ? "opacity-100 translate-y-0 pointer-events-auto" 
                    : "opacity-0 -translate-y-8 pointer-events-none"
                )}
                style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              >
                <DiscoveryIntentTabs 
                  city={currentCity} 
                  currentIntent={currentIntent}
                />
              </div>

              {/* Layer 2: Compact Search - Slides up and fades in */}
              <div 
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "transition-[opacity,transform] duration-250 ease-out",
                  "will-change-[transform,opacity]",
                  isCompact 
                    ? "opacity-100 translate-y-0 pointer-events-auto" 
                    : "opacity-0 translate-y-4 pointer-events-none"
                )}
                style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              >
                <div className="w-full max-w-[600px] flex items-center gap-3">
                  <div className="flex-1">
                    <DesktopSearchControl 
                      citySlug={currentCity}
                      isCompact={true}
                      onExpand={() => setIsExpanded(true)}
                      onCollapse={() => setIsExpanded(false)}
                      currentIntent={currentIntent}
                    />
                  </div>
                  
                  {shouldShowFilters && (
                    <RefinementFiltersButtonCompact intent={currentIntent} />
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT ANCHOR - Stable, never animates */}
            <div className="flex items-center gap-3">
              <Link
                href="/me"
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Избранное"
              >
                <Heart className="h-5 w-5 text-gray-600" />
              </Link>
              
              <Link
                href="/account"
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Профіль"
              >
                <User className="h-5 w-5 text-gray-600" />
              </Link>
            </div>

            {/* ============================================ */}
            {/* ROW 2 - Full Search Row (only in full state) */}
            {/* ============================================ */}
            
            {/* Empty spacer matching left anchor width */}
            <div 
              className={cn(
                "w-[81px] transition-[opacity] duration-300 ease-out",
                isFull ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            />

            {/* Center: Full Search Form */}
            <div 
              className={cn(
                "flex items-center justify-center",
                "transition-[opacity,transform] duration-250 ease-out",
                "will-change-[transform,opacity]",
                isFull 
                  ? "opacity-100 translate-y-0 pointer-events-auto" 
                  : "opacity-0 -translate-y-4 pointer-events-none"
              )}
              style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
            >
              <div className="w-full max-w-[850px]">
                <DesktopSearchControl 
                  citySlug={currentCity}
                  isCompact={false}
                  onExpand={() => setIsExpanded(true)}
                  onCollapse={() => setIsExpanded(false)}
                  currentIntent={currentIntent}
                />
              </div>
            </div>

            {/* Empty spacer matching right anchor width */}
            <div 
              className={cn(
                "w-[81px] transition-[opacity] duration-300 ease-out",
                isFull ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            />
          </div>
        </div>
      </div>
    </header>
    </>
  );
}