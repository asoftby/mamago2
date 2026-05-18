import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";
import { ActivityCard } from "@/components/content-cards";
import {
  ActivityActionsFeed,
  ActivityActionsPlan,
  type ActivityCardItem,
} from "@/features/activities";

const baseEvent: ActivityCardItem = {
  id: "event-1",
  type: "event",
  title: "Научное шоу с экспериментами для детей и родителей",
  href: "/events/nautical-showcase",
  imageUrl:
    "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
  badgeLabel: "Выходные",
  dateLabel: "18 мая · 14:00",
  placeTitle: "Планетарий",
  addressLabel: "Минск, Фрунзе, 2",
  priceLabel: "от 25 BYN",
  ageLabel: "5+",
  categoryLabel: "Наука",
  isSaved: false,
  isPlanned: false,
  isPast: false,
  statusLabel: null,
};

const baseOffer: ActivityCardItem = {
  id: "offer-1",
  type: "offer",
  title: "Летний городской лагерь с английским и мастерскими",
  href: "/offers/city-camp",
  imageUrl:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=80",
  badgeLabel: "-10% до 31.05",
  dateLabel: "Июнь–август",
  placeTitle: "Kids Hub",
  addressLabel: "Минск, Победителей, 101",
  priceLabel: "от 650 BYN",
  ageLabel: "7+",
  categoryLabel: "Лагерь",
  isSaved: false,
  isPlanned: false,
  isPast: false,
  statusLabel: "Набор открыт",
};

function CardsShowcase() {
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/ui-lab"
          className="inline-flex rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Назад в UI Lab
        </Link>
      </div>

      <DemoSection
        id="activity-cards"
        title="Activity Cards"
        description="Новый unified shell для events + offers. Источник правок — production-компонент, а не витрина."
      >
        <InventoryGrid>
          <RenderSafe
            title="Event Default"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={baseEvent}
              actions={<ActivityActionsFeed isSaved={baseEvent.isSaved} isPlanned={baseEvent.isPlanned} />}
            />
          </RenderSafe>

          <RenderSafe
            title="Offer Default"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={baseOffer}
              actions={<ActivityActionsFeed isSaved={baseOffer.isSaved} isPlanned={baseOffer.isPlanned} />}
            />
          </RenderSafe>

          <RenderSafe
            title="Compact"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={baseEvent}
              variant="compact"
              density="compact"
              actions={<ActivityActionsFeed />}
            />
          </RenderSafe>

          <RenderSafe
            title="Horizontal"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={baseOffer}
              variant="horizontal"
              actions={<ActivityActionsFeed />}
            />
          </RenderSafe>

          <RenderSafe
            title="Plan Variant"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseEvent, isPlanned: true }}
              variant="plan"
              actions={<ActivityActionsPlan />}
            />
          </RenderSafe>

          <RenderSafe
            title="My Ideas / Plan Actions"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseEvent, isSaved: true }}
              variant="plan"
              density="compact"
              actions={
                <ActivityActionsPlan
                  item={{ ...baseEvent, isSaved: true }}
                  scheduleLabel="Запланировать"
                  removeLabel="Убрать"
                />
              }
            />
          </RenderSafe>

          <RenderSafe
            title="No Image"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseEvent, imageUrl: null, badgeLabel: null }}
              actions={<ActivityActionsFeed />}
            />
          </RenderSafe>

          <RenderSafe
            title="Past Event"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseEvent, isPast: true, dateLabel: "3 мая · 11:00" }}
              actions={<ActivityActionsFeed />}
            />
          </RenderSafe>

          <RenderSafe
            title="Saved"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseOffer, isSaved: true }}
              actions={<ActivityActionsFeed isSaved />}
            />
          </RenderSafe>

          <RenderSafe
            title="Planned"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{ ...baseEvent, isPlanned: true, statusLabel: "На 19 мая" }}
              actions={<ActivityActionsFeed isPlanned />}
            />
          </RenderSafe>

          <RenderSafe
            title="Long Title"
            file="src/components/content-cards/ActivityCard.tsx"
          >
            <ActivityCard
              item={{
                ...baseOffer,
                title:
                  "Большой семейный интенсив по робототехнике, инженерным экспериментам и проектной сборке для детей, которым мало обычного кружка",
              }}
              actions={<ActivityActionsFeed />}
            />
          </RenderSafe>
        </InventoryGrid>
      </DemoSection>
    </div>
  );
}

export default function UiLabCardsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="text-foreground">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <header className="mb-12 space-y-4">
          <div className="inline-block rounded-md bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
            DEV ONLY
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            UI Lab — Cards
          </h1>
          <p className="max-w-2xl text-xl text-muted-foreground">
            Витрина состояний нового unified `ActivityCard`. Реальные production-компоненты остаются в своих source-папках.
          </p>
        </header>

        <CardsShowcase />
      </div>
    </div>
  );
}
