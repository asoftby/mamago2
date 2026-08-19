"use client";

import { PlaceHero } from "./PlaceHero";
import { PlaceSidebarCard } from "./PlaceSidebarCard";
import { PlaceContent } from "./PlaceContent";
import { PlaceEventsCarousel } from "./PlaceEventsCarousel";
import { PlaceOffersCarousel } from "./PlaceOffersCarousel";
import { PlaceAllReviews } from "./PlaceAllReviews";
import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedPlacePhone } from "@/lib/place/placePhones";
import { PlacePhoneActionButton } from "@/components/place/PlacePhoneActions";

interface PremiumPlacePageProps {
  place: {
    id: string;
    title: string;
    slug: string;
    category: string;
    shortDesc: string;
    description: string;
    logoUrl?: string | null;
    rating?: number;
    reviewCount?: number;

    // Quick facts (optional расширения)
    yearFounded?: number;
    languages?: string[];
    capacity?: number;

    // Contact
    phones: NormalizedPlacePhone[];
    email?: string;
    website?: string;
    instagramUrl?: string;

    // Location
    address?: string;
    city?: string;
    district?: string;
    latitude?: number;
    longitude?: number;

    /** Hero: breadcrumbs, карты, график */
    breadcrumbItems: Array<{ label: string; href?: string }>;
    mapsOpenUrl?: string;
    mapsDirectionsUrl?: string;
    workingHoursSummary?: string;

    // Content
    features?: string[];
    amenities?: string[];
    
    // Media
    images?: Array<{
      id: string;
      url: string;
      alt?: string;
    }>;
  };
  
  events?: Array<{
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
    startDate: string;
    endDate?: string;
    location?: string;
    price?: number;
    category?: string;
  }>;
  
  offers?: Array<{
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
    description?: string;
    price?: number;
    discount?: number;
    duration?: string;
    capacity?: number;
    category?: string;
  }>;
  
  reviews?: Array<{
    id: string;
    source: "MAMAGO" | "GOOGLE";
    authorName: string;
    authorAvatarUrl?: string | null;
    rating: number;
    text?: string | null;
    publishedAt: Date;
    relativeTimeDescription?: string | null;
    ownerReplyText?: string | null;
    ownerReplyAuthorName?: string | null;
    ownerReplyCreatedAt?: Date | null;
  }>;
  
  canEdit?: boolean;
}

export function PremiumPlacePage({
  place,
  events = [],
  offers = [],
  reviews = [],
  canEdit = false,
}: PremiumPlacePageProps) {
  const heroImage = place.images?.[0]?.url || place.logoUrl || undefined;

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_18%_8%,rgba(239,135,89,0.18),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(108,99,255,0.18),transparent_32%),linear-gradient(135deg,#ffffff_0%,#F7F7FB_48%,#F3F0FF_100%)] text-[#111322]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-[-120px] top-24 h-80 w-80 rounded-full bg-[#EF8759]/20 blur-3xl"
        animate={{ y: [0, 28, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-80px] top-80 h-96 w-96 rounded-full bg-[#6C63FF]/20 blur-3xl"
        animate={{ y: [0, -34, 0], x: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(108,99,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(239,135,89,0.11)_1px,transparent_1px)] [background-size:64px_64px]"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 pb-28 pt-4 sm:px-6 lg:pb-32">
        <PlaceHero
          title={place.title}
          shortDesc={place.shortDesc}
          logoUrl={place.logoUrl}
          imageUrl={heroImage}
          rating={place.rating}
          reviewCount={place.reviewCount}
          canEdit={canEdit}
          placeId={place.id}
          breadcrumbItems={place.breadcrumbItems}
          address={place.address}
          mapsOpenUrl={place.mapsOpenUrl}
          mapsDirectionsUrl={place.mapsDirectionsUrl}
          workingHoursSummary={place.workingHoursSummary}
          district={place.district}
        />

        <PlaceStickyNav showPrograms={events.length > 0} />

        <div className="grid grid-cols-1 gap-12 py-14 lg:grid-cols-[1fr_360px] lg:gap-16 lg:py-20">
          <main className="min-w-0 space-y-20">
            <PlaceContent
              description={place.description}
              features={place.features}
              amenities={place.amenities}
            />

            {events.length > 0 && (
              <motion.section
                id="programs"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <PlaceEventsCarousel events={events} placeId={place.id} />
              </motion.section>
            )}

            {offers.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <PlaceOffersCarousel offers={offers} placeId={place.id} />
              </motion.section>
            )}

            <PlaceAllReviews
              reviews={reviews}
              averageRating={place.rating}
              totalCount={place.reviewCount}
              placeId={place.id}
              placeName={place.title}
            />
          </main>

          <aside className="min-w-0">
            <PlaceSidebarCard
              placeId={place.id}
              phones={place.phones}
              website={place.website}
              instagramUrl={place.instagramUrl}
              placeName={place.title}
            />
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 rounded-[28px] border border-white/60 bg-white/80 p-2 shadow-[0_24px_80px_rgba(17,19,34,0.18)] backdrop-blur-2xl lg:hidden">
        {place.phones.length > 0 ? (
          <PlacePhoneActionButton
            phones={place.phones}
            placeTitle={place.title}
            className="flex w-full items-center justify-center"
          >
            <MobileAction
              asSpan
              icon={<Phone className="h-4 w-4" />}
              label="Позвонить"
              primary
            />
          </PlacePhoneActionButton>
        ) : null}
      </div>
    </div>
  );
}

const NAV_TABS_FULL: Array<[string, string]> = [
  ["about", "Описание"],
  ["benefits", "Преимущества"],
  ["programs", "Программы"],
  ["reviews", "Отзывы"],
];

/** Sticky chips + anchored sections: line slightly below sticky bar so active tab follows scroll. */
const NAV_SCROLL_ACTIVATION_PX = 96;

function PlaceStickyNav({ showPrograms }: { showPrograms: boolean }) {
  const tabs = useMemo(
    () =>
      NAV_TABS_FULL.filter(([id]) => {
        if (id === "programs") return showPrograms;
        return true;
      }),
    [showPrograms],
  );

  const ids = tabs.map(([id]) => id);
  const tabsRef = useRef(ids);

  useEffect(() => {
    tabsRef.current = ids;
  }, [ids]);

  const [activeId, setActiveId] = useState(() => ids[0] ?? "about");
  const [prevIds, setPrevIds] = useState(ids);

  if (ids !== prevIds) {
    setPrevIds(ids);
    if (!ids.includes(activeId)) {
      setActiveId(ids[0] ?? "about");
    }
  }

  const rafPending = useRef(false);

  const resolveScrollActive = useCallback(() => {
    const list = tabsRef.current;
    let chosen = list[0] ?? "about";

    for (const id of list) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= NAV_SCROLL_ACTIVATION_PX) chosen = id;
      else break;
    }
    setActiveId(chosen);
  }, []);

  useEffect(() => {
    const fromHash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (fromHash && ids.includes(fromHash)) {
      queueMicrotask(() => setActiveId(fromHash));
    }
  }, [ids]);

  useEffect(() => {
    const onScroll = () => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        resolveScrollActive();
      });
    };

    requestAnimationFrame(() => {
      resolveScrollActive();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [resolveScrollActive]);

  const onTabClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="sticky top-[15px] z-40 mt-6 flex justify-center">
      <nav className="max-w-full overflow-x-auto rounded-full border border-white/70 bg-white/70 p-1.5 shadow-[0_18px_60px_rgba(108,99,255,0.14)] backdrop-blur-2xl">
        <div className="flex min-w-max items-center gap-1">
          {tabs.map(([id, label]) => {
            const isActive = activeId === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={isActive ? "true" : undefined}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(239,135,89,0.35)] hover:bg-primary/92"
                    : "text-[#5D6174] hover:bg-white hover:text-[#0D1025]"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  onTabClick(id);
                }}
              >
                {label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MobileAction({
  href,
  icon,
  label,
  primary,
  asSpan = false,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  asSpan?: boolean;
}) {
  const className = `flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black ${
    primary
      ? "bg-gradient-to-r from-[#EF8759] to-[#6C63FF] text-white shadow-[0_12px_30px_rgba(108,99,255,0.28)]"
      : "bg-white/80 text-[#17192A]"
  }`;
  const content = (
    <>
      {icon}
      {label}
    </>
  );

  if (asSpan) {
    return <span className={className}>{content}</span>;
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}
