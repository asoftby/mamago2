"use client";

import { Container } from "@/components/ui/Container";
import { BreakingNewsRow } from "@/components/news/BreakingNewsRow";
import { IntentTabs } from ".";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { Intent } from "@/lib/intent";
import { H1 } from "@/components/ui/typography";
import { DiscoveryFilters } from "@/features/discovery/filters/DiscoveryFilters";

// Mock data (in a real app this would come from a server loader based on city/intent)
const BREAKING_NEWS = [
  { id:"n1", title:"Новая «Пуговка» в Северном Береге", imageUrl:"https://picsum.photos/seed/bn1/800/600", timeAgo:"1 день назад" },
  { id:"n2", title:"Скидка 50% в студии вокала Music Soul", imageUrl:"https://picsum.photos/seed/bn2/800/600", timeAgo:"2 недели назад" },
  { id:"n3", title:"Новый ресторан — семейное меню и детская комната", imageUrl:"https://picsum.photos/seed/bn3/800/600", timeAgo:"3 недели назад" },
  { id:"n4", title:"Гастрофест: сет за 14 BYN — успейте на выходных", imageUrl:"https://picsum.photos/seed/bn4/800/600", timeAgo:"4 недели назад" },
  { id:"n5", title:"Светлое кафе у вокзала с ретро-авто", imageUrl:"https://picsum.photos/seed/bn5/800/600", timeAgo:"1 месяц назад" },
  { id:"n6", title:"Впервые в Беларуси: премия для детских проектов", imageUrl:"https://picsum.photos/seed/bn6/800/600", timeAgo:"1 месяц назад" },
  { id:"n7", title:"Открылся новый детский центр развития в Уручье", imageUrl:"https://picsum.photos/seed/bn7/800/600", timeAgo:"2 дня назад" },
  { id:"n8", title:"Мастер-классы по робототехнике для детей 6-12 лет", imageUrl:"https://picsum.photos/seed/bn8/800/600", timeAgo:"5 дней назад" },
  { id:"n9", title:"Семейный фестиваль «Краски лета» в парке Челюскинцев", imageUrl:"https://picsum.photos/seed/bn9/800/600", timeAgo:"1 неделя назад" },
  { id:"n10", title:"Бесплатные занятия йогой для мам с малышами", imageUrl:"https://picsum.photos/seed/bn10/800/600", timeAgo:"2 недели назад" },
];

interface CityIntentShellProps {
  city: string;
  intent: Intent;
}

export function CityIntentShell({ 
  city, 
  intent,
}: CityIntentShellProps) {
  
  // Filter activities based on intent (mock logic)
  const filteredActivities = MINSK_ACTIVITIES; // In real app, this is filtered on server

  // Map Intent if needed in future

  return (
    <main className="min-h-screen bg-background pb-20">
      <Container className="pt-4 space-y-6">
        {/* Breaking News */}
        <BreakingNewsRow items={BREAKING_NEWS} onAllClickHref="#" />

        {/* Navigation & Filters */}
        <div className="space-y-4">
          <div className="text-xs text-red-500">SHELL_V2: {intent}</div>
          <IntentTabs />
          <H1 className="px-1 mt-[30px]">
            {intent === 'kuda' && "Куда пойти с ребёнком в Минске?"}
            {intent === 'classes' && "Детские занятия и секции"}
            {intent === 'birthday' && "Организация детского праздника"}
            {intent === 'journal' && "Журнал для родителей"}
          </H1>
          
          {/* Filters */}
          {(intent === 'kuda' || intent === 'classes' || intent === 'birthday') && (
            <div className="py-2">
              <div className="mt-4">
                <DiscoveryFilters citySlug={city} />
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
          {filteredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </Container>
    </main>
  );
}
