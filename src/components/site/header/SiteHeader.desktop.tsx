"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User } from "lucide-react";
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
  const isScrolled = useHeaderScrolled(20);
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

  // Collapse on scroll delta when expanded (5-10% of viewport height)
  useEffect(() => {
    if (!isExpanded) return;

    const initialScrollY = window.scrollY;
    const scrollThreshold = window.innerHeight * 0.1; // 10% of viewport height

    const handleScroll = () => {
      // Check ref to get current state
      if (!expandedRef.current) return;
      
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - initialScrollY);
      
      // If scrolled more than threshold from initial position, collapse
      if (scrollDelta > scrollThreshold) {
        setIsExpanded(false);
      }
    };

    // Add small delay to prevent immediate collapse
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
  const showCompact = isScrolled && !isExpanded;
  const showFull = !isScrolled || isExpanded;

  return (
    <header 
      className={cn(
        "sticky top-0 z-[100] w-full transition-all duration-150 ease-out",
        "hidden md:block bg-white border-b border-gray-200",
        isScrolled ? "shadow-lg" : "shadow-sm"
      )}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4">
        {/* Dynamic Header Container */}
        <div 
          className={cn(
            "transition-all duration-150 ease-out",
            showFull ? "py-[30px]" : "py-[15px]" // Compact padding when scrolled
          )}
        >
          {/* Three-Column Layout */}
          <div className="flex items-center">
            {/* LEFT: Logo - Always visible */}
            <div className="w-1/4 flex items-center justify-start">
              <Link href="/minsk" className="hover:opacity-80 transition-opacity">
                <Image
                  src="/favico_mamago.webp"
                  alt="MamaGo"
                  width={100}
                  height={100}
                  priority
                  className="w-auto h-[40px]"
                />
              </Link>
            </div>

            {/* CENTER: Dynamic Search Area */}
            <div className="w-1/2 flex flex-col items-center">
              {/* Intent Navigation - Animated with minimal transition */}
              <div 
                className={cn(
                  "w-full transition-all duration-150 ease-out overflow-hidden",
                  showFull 
                    ? "max-h-[100px] opacity-100 mb-3 py-[15px]" 
                    : "max-h-0 opacity-0 mb-0 py-0"
                )}
              >
                <DiscoveryIntentTabs 
                  city={currentCity} 
                  currentIntent={currentIntent}
                />
              </div>

              {/* Search Form + Filters Container */}
              <div className={cn(
                "w-full flex items-center gap-3 transition-all duration-150 ease-out",
                showFull ? "max-w-[600px]" : "max-w-[480px]" // 20% smaller when compact
              )}>
                {/* Single Search Form - Transforms between states */}
                <div className="flex-1">
                  <DesktopSearchControl 
                    citySlug={currentCity}
                    isCompact={showCompact}
                    onExpand={() => setIsExpanded(true)}
                    onCollapse={() => setIsExpanded(false)}
                    currentIntent={currentIntent}
                  />
                </div>

                {/* Filters Button - Only in compact state on intent pages */}
                {showCompact && shouldShowFilters && (
                  <div className={cn(
                    "transition-all duration-150 ease-out",
                    showCompact ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  )}>
                    <RefinementFiltersButtonCompact intent={currentIntent} />
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Profile Actions - Circular buttons like logo size */}
            <div 
              className={cn(
                "w-1/4 flex items-center justify-end transition-all duration-150",
                showCompact ? "gap-3" : "gap-4"
              )}
            >
              {/* Favorites Button */}
              <Link
                href="/me"
                className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
                aria-label="Избранное"
              >
                <Heart className="h-5 w-5 text-gray-600" />
              </Link>
              
              {/* Profile Button */}
              <Link
                href="/me/profile"
                className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
                aria-label="Профиль"
              >
                <User className="h-5 w-5 text-gray-600" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}