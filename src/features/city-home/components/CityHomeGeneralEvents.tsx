"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { HomeMoreEventsCard } from "./HomeMoreEventsCard";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { ActivityMock } from "@/types/activity";

const MAX_PREVIEW_EVENTS = 10;
// Guests never download the child onboarding forms. These are needed on click only.
const FamilyActivationAddChildOverlay = dynamic(() => import("./FamilyActivationAddChildOverlay").then(m => m.FamilyActivationAddChildOverlay), { ssr: false });
const FamilyActivationEditChildBirthOverlay = dynamic(() => import("./FamilyActivationEditChildBirthOverlay").then(m => m.FamilyActivationEditChildBirthOverlay), { ssr: false });

/** Guests see the public afisha without age chips, registration prompts or additional filter requests. */
export function CityHomeGeneralEvents({
  activities, citySlug, authenticated = false, hasChildren = false, incompleteChild = null, periodLabel = "На этой неделе",
}: {
  activities: ActivityMock[]; citySlug: string; authenticated?: boolean; hasChildren?: boolean;
  periodLabel?: "На этой неделе" | "Ближайшие события";
  incompleteChild?: { id: string; name: string | null } | null;
}) {
  const [addingChild, setAddingChild] = useState(false);
  const [editingBirth, setEditingBirth] = useState(false);
  const catalogHref = "/" + citySlug + "/events";

  return <CityHomeSection
    title={authenticated ? "События, которые подходят вам" : "Куда пойти с ребёнком " + getCityLocativePhrase(citySlug)}
    subtitle={periodLabel} reserveCarouselControls>
    {authenticated && (!hasChildren || incompleteChild) && <div className="mb-4 flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {incompleteChild ? "Укажите возраст ребёнка для персональной афиши." : "Добавьте ребёнка — персонализируем афишу."}
      </span>
      <button type="button" onClick={() => incompleteChild ? setEditingBirth(true) : setAddingChild(true)}
        className="min-h-11 rounded-full border border-primary px-4 text-sm font-medium text-primary hover:bg-primary/5">
        {incompleteChild ? "Указать возраст" : "+ Добавить ребёнка"}
      </button>
    </div>}
    {!activities.length && <p role="status" className="py-6 text-sm text-muted-foreground">Пока нет опубликованных событий. Загляните позже.</p>}
    <HorizontalCardRow headerHasSubtitle>
      {activities.slice(0, MAX_PREVIEW_EVENTS).map((activity, index) => (
        <div key={activity.id} className={EVENT_CARD_SHELL + " flex flex-col"}>
          <AnalyticsCardViewTracker entityType="EVENT" entityId={activity.id} vertical="CITY" citySlug={citySlug}
            threshold={0.5} dwellMs={1000} meta={{ section: "afisha", exposureId: activity.exposureId ?? null }}>
            <EventCard {...activityMockToEventCard(activity, citySlug)} framing="fixed" coverRatio="2/3" coverFit="cover"
              className="h-full" imagePriority={index < 2} />
          </AnalyticsCardViewTracker>
        </div>
      ))}
      <HomeMoreEventsCard href={catalogHref} />
    </HorizontalCardRow>
    {authenticated && <>
      <FamilyActivationAddChildOverlay open={addingChild} onOpenChange={setAddingChild}
        onSuccess={() => {}} />
      <FamilyActivationEditChildBirthOverlay open={editingBirth} onOpenChange={setEditingBirth}
        child={incompleteChild ? { id: incompleteChild.id, name: incompleteChild.name ?? "" } : null}
        onSuccess={() => {}} />
    </>}
  </CityHomeSection>;
}
