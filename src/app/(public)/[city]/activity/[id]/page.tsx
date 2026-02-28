"use client";

import React, { use } from "react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IconButton } from "@/components/ui/IconButton";
import { IconHeart, IconShare, IconClose } from "@/components/ui/icons";
import { isFavorite as checkIsFavorite, toggleFavorite } from "@/lib/favorites";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Using a simple arrow for back if not available
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

interface ActivityPageProps {
  params: Promise<{ city: string; id: string }>;
}

export default function ActivityPage({ params }: ActivityPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  // In a real app, fetch data based on resolvedParams.id
  const activity = MINSK_ACTIVITIES.find(a => a.id === resolvedParams.id);

  const [isFavorite, setIsFavorite] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  // Compute display labels
  const dateLabel = activity?.dateStart 
    ? new Date(activity.dateStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : activity?.workingHours;
    
  const priceLabel = activity?.priceMin === 0 
    ? "Бесплатно" 
    : activity?.priceMin 
      ? `от ${activity.priceMin} ${activity.currency}` 
      : undefined;

  const ageLabel = activity ? `${activity.ageFrom}+` : undefined;

  React.useEffect(() => {
    if (activity) {
      setIsFavorite(checkIsFavorite(activity.id));
    }
  }, [activity]);

  const handleToggleFavorite = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activity) {
      toggleFavorite(activity.id);
      setIsFavorite(prev => !prev);
    }
  };

  const handleShare = () => {
    console.log("share", activity?.id);
  };

  if (!activity) {
    return (
      <Container className="pt-20 text-center">
        <h1 className="text-2xl font-bold">Activity not found</h1>
        <Link href={`/${resolvedParams.city}`} className="text-primary hover:underline mt-4 block">
          Back to feed
        </Link>
      </Container>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="flex flex-col h-full">
        {/* Image Section - Hero */}
        <div className="relative w-full aspect-[4/3] md:aspect-[21/9] overflow-hidden bg-muted shrink-0">
          {!imgError && activity.image.startsWith("http") ? (
            <img
              src={activity.image}
              alt={activity.title}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-muted-foreground ${!activity.image.startsWith("http") ? activity.image : 'bg-muted'}`}>
              {!activity.image.startsWith("http") ? '' : 'Нет фото'}
            </div>
          )}
          
          {/* Navigation & Actions */}
          <div className="absolute top-4 left-4 z-10">
            <IconButton 
              label="Back" 
              onClick={() => router.back()} 
              className="hover:text-primary"
            >
              <ArrowLeft className="h-6 w-6" />
            </IconButton>
          </div>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
            <IconButton label="Share" onClick={handleShare} className="hover:text-primary">
              <IconShare className="h-5 w-5" />
            </IconButton>
            
            <IconButton 
              label="Favorite" 
              onClick={handleToggleFavorite}
              className={isFavorite ? "text-primary hover:text-primary" : "hover:text-primary"}
            >
              <IconHeart className={isFavorite ? "fill-current text-primary h-5 w-5" : "h-5 w-5"} filled={isFavorite} />
            </IconButton>
          </div>
        </div>

        {/* Content */}
        <Container className="space-y-6 py-6 md:py-10 max-w-4xl">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{activity.title}</h1>
            
            {/* Meta + Badge */}
            <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
              {activity.badge && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 shadow-none font-medium text-sm">
                  {activity.badge}
                </Badge>
              )}
              
              {activity.rating && (
                <div className="flex items-center gap-1 text-foreground font-medium">
                  <span className="text-warning">★</span>
                  <span>{activity.rating}</span>
                </div>
              )}
              {ageLabel && (
                <span className="bg-muted px-2 py-0.5 rounded-md text-foreground text-sm">
                  {ageLabel}
                </span>
              )}
              {dateLabel && <span>{dateLabel}</span>}
            </div>
          </div>

          {priceLabel && (
            <div className="text-2xl font-semibold text-primary">
              {priceLabel}
            </div>
          )}

          <div className="text-lg text-muted-foreground leading-relaxed">
            {activity.description || 
              "Это увлекательное событие подарит вашему ребёнку массу эмоций! Интерактивная программа, профессиональные аниматоры и безопасная среда. Рекомендуем приходить за 15 минут до начала."
            }
          </div>

          {/* CTA Button */}
          <div className="pt-6">
            <PrimaryButton className="w-full md:w-auto md:min-w-[300px] text-lg h-14 rounded-2xl shadow-lg shadow-primary/20">
              Купить билет
            </PrimaryButton>
          </div>
        </Container>
      </div>
    </main>
  );
}
