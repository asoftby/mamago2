import { PlanCard } from "@/features/me/components/PlanCard";
import type { PlanItemWithActivity } from "@/server/services/plan.service";
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { getComponentMeta } from "@/components/ui-lab/registry";

// Mock data for demonstrations
const mockActivity1: NonNullable<PlanItemWithActivity["activity"]> = {
  id: "act1",
  slug: "detskaya-yoga",
  title: "Детская йога в парке",
  type: "EVENT",
  coverImageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
  ageLabel: "5-10 лет",
  eventCategory: { nameRu: "Спорт" },
  priceFrom: 15,
  priceText: null,
  currency: "BYN",
  status: "PUBLISHED",
  owner: { business: { operationalStatus: "ACTIVE" } },
  place: { shortAddress: "Парк Горького", formattedAddr: null, customAddress: null, city: { name: "Минск" } },
  venue: null,
};

const mockActivity2: NonNullable<PlanItemWithActivity["activity"]> = {
  id: "act2",
  slug: "masterclass-risovanie",
  title: "Мастер-класс по рисованию",
  type: "EVENT",
  coverImageUrl: null,
  ageLabel: "6+ лет",
  eventCategory: { nameRu: "Творчество" },
  priceFrom: 20,
  priceText: null,
  currency: "BYN",
  status: "PUBLISHED",
  owner: null,
  place: null,
  venue: null,
};

const mockActivity3: NonNullable<PlanItemWithActivity["activity"]> = {
  id: "act3",
  slug: "teatralnaya-studiya",
  title: "Театральная студия для малышей",
  type: "EVENT",
  coverImageUrl: "https://images.unsplash.com/photo-1503095396549-807759245b35?w=400",
  ageLabel: "4-7 лет",
  eventCategory: { nameRu: "Театр" },
  priceFrom: 25,
  priceText: null,
  currency: "BYN",
  status: "PUBLISHED",
  owner: null,
  place: null,
  venue: null,
};

function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().split("T")[0];
  });
}

export function PlanCardSection() {
  const weekDates = getWeekDates();
  const todayStr = new Date().toISOString().split("T")[0];

  // State 1: Empty week
  const emptyPlanItems: Record<string, PlanItemWithActivity[]> = {};

  // State 2: Week with 1 item
  const singleItemPlanItems: Record<string, PlanItemWithActivity[]> = {
    [weekDates[2]]: [
      {
        id: "plan1",
        userId: "user1",
        activityId: "act1",
        date: weekDates[2],
        startsAt: new Date(`${weekDates[2]}T10:00:00`),
        title: null,
        coverImageUrl: null,
        createdAt: new Date(),
        activity: mockActivity1,
      },
    ],
  };

  // State 3: Week with multiple items
  const multipleItemsPlanItems: Record<string, PlanItemWithActivity[]> = {
    [weekDates[1]]: [
      {
        id: "plan2",
        userId: "user1",
        activityId: "act2",
        date: weekDates[1],
        startsAt: null,
        title: null,
        coverImageUrl: null,
        createdAt: new Date(),
        activity: mockActivity2,
      },
    ],
    [weekDates[3]]: [
      {
        id: "plan3",
        userId: "user1",
        activityId: "act1",
        date: weekDates[3],
        startsAt: new Date(`${weekDates[3]}T14:30:00`),
        title: null,
        coverImageUrl: null,
        createdAt: new Date(),
        activity: mockActivity1,
      },
      {
        id: "plan4",
        userId: "user1",
        activityId: "act3",
        date: weekDates[3],
        startsAt: new Date(`${weekDates[3]}T16:00:00`),
        title: null,
        coverImageUrl: null,
        createdAt: new Date(),
        activity: mockActivity3,
      },
    ],
    [weekDates[5]]: [
      {
        id: "plan5",
        userId: "user1",
        activityId: "act2",
        date: weekDates[5],
        startsAt: new Date(`${weekDates[5]}T11:00:00`),
        title: null,
        coverImageUrl: null,
        createdAt: new Date(),
        activity: mockActivity2,
      },
    ],
  };

  const componentMeta = getComponentMeta("plan-card", "ui-lab");

  return (
    <section id="plan-card" className="space-y-8">
      {componentMeta && (
        <ComponentMetaCard {...componentMeta}>
          <div className="space-y-12">
            {/* State 1: Empty Week */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">Empty Week</h3>
                <p className="text-sm text-muted-foreground">
                  No plan items. Shows empty state with CTA.
                </p>
              </div>
              <PlanCard
                weekDates={weekDates}
                planItemsByDate={emptyPlanItems}
                selectedDate={todayStr}
              />
            </div>

            {/* State 2: Week with 1 Item */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">Week with 1 Item</h3>
                <p className="text-sm text-muted-foreground">
                  Single plan item on Wednesday. Shows footer hint to add more.
                </p>
              </div>
              <PlanCard
                weekDates={weekDates}
                planItemsByDate={singleItemPlanItems}
                selectedDate={weekDates[2]}
              />
            </div>

            {/* State 3: Week with Multiple Items */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">Week with Multiple Items</h3>
                <p className="text-sm text-muted-foreground">
                  Multiple items across different days. Shows scenario button, item indicators, and mini-cards.
                </p>
              </div>
              <PlanCard
                weekDates={weekDates}
                planItemsByDate={multipleItemsPlanItems}
                selectedDate={weekDates[3]}
              />
            </div>
          </div>
        </ComponentMetaCard>
      )}
    </section>
  );
}
