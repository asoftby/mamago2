"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HomeEventsQuickChips } from "./HomeSectionQuickChips";
import { HomeCarouselHeading, CityHomeAllLink } from "./SectionHeader";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { HomeMoreEventsCard } from "./HomeMoreEventsCard";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { applyPersonaRanking } from "../lib/personaRanking";
import type { ActivityMock } from "@/types/activity";

const MAX_PREVIEW_EVENTS = 10;
// Guests never download the child onboarding forms. These are needed on click only.
const FamilyActivationAddChildOverlay = dynamic(() => import("./FamilyActivationAddChildOverlay").then(m => m.FamilyActivationAddChildOverlay), { ssr: false });
const FamilyActivationEditChildBirthOverlay = dynamic(() => import("./FamilyActivationEditChildBirthOverlay").then(m => m.FamilyActivationEditChildBirthOverlay), { ssr: false });

/** Guests see the public afisha without age chips, registration prompts or additional filter requests. */
export function CityHomeGeneralEvents({
  activities, citySlug, authenticated = false, hasChildren = false, incompleteChild = null,
}: {
  activities: ActivityMock[]; citySlug: string; authenticated?: boolean; hasChildren?: boolean;
  periodLabel?: "На ближайшие 30 дней" | "Ближайшие события";
  incompleteChild?: { id: string; name: string | null } | null;
  incompleteChildren?: { id: string; name: string | null }[];
}) {
  const [addingChild, setAddingChild] = useState(false);
  const [editingChild, setEditingChild] = useState<{ id: string; name: string | null } | null>(null);
  const router = useRouter();
  const family = useFamilyPersona();
  const preview = useMemo(() => authenticated
    ? applyPersonaRanking(activities, { personas: family?.personas ?? [],
        selectedPersonaIds: family?.selectedPersonaIds ?? [] })
    : activities, [authenticated, activities, family?.personas, family?.selectedPersonaIds]);
  const catalogHref = "/" + citySlug + "/events";

  return <CityHomeSection
    title={authenticated ? "События, которые подходят вашей семье" : "Куда пойти с ребёнком " + getCityLocativePhrase(citySlug)}
    hideHeader>
    <HorizontalCardRow
      headerTitle={<HomeCarouselHeading title={authenticated ? "События, которые подходят вашей семье" : "Куда пойти с ребёнком " + getCityLocativePhrase(citySlug)}  />}
      navLeading={<CityHomeAllLink href={catalogHref} label="[все события]" />}
      underHeader={<>
        <HomeEventsQuickChips citySlug={citySlug} />
    {authenticated && (!hasChildren || incompleteChild) && <div className="mb-4 flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {incompleteChild ? "Укажите возраст ребёнка для персональной афиши." : "Добавьте ребёнка — персонализируем афишу."}
      </span>
      <button type="button" onClick={() => incompleteChild ? setEditingChild(incompleteChild) : setAddingChild(true)}
        className="min-h-11 rounded-full border border-primary px-4 text-sm font-medium text-primary hover:bg-primary/5">
        {incompleteChild ? "Указать возраст" : "+ Добавить ребёнка"}
      </button>
    </div>}
    {!preview.length && <p role="status" className="py-6 text-sm text-muted-foreground">Событий пока нет.</p>}
      </>}
    >
      {preview.slice(0, MAX_PREVIEW_EVENTS).map((activity, index) => (
        <div key={activity.id} className={EVENT_CARD_SHELL + " flex flex-col"}>
          <AnalyticsCardViewTracker entityType="EVENT" entityId={activity.id} vertical="CITY" citySlug={citySlug}
            threshold={0.5} dwellMs={1000} meta={{ section: "afisha", exposureId: activity.exposureId ?? null }}>
            <EventCard {...activityMockToEventCard(activity, citySlug)} framing="fixed" coverRatio="2/3" coverFit="cover"
              className="h-full" imagePriority={index < 2} />
          </AnalyticsCardViewTracker>
        </div>
      ))}
      {preview.length > 0 && <HomeMoreEventsCard href={catalogHref} />}
    </HorizontalCardRow>
    {authenticated && <>
      <FamilyActivationAddChildOverlay open={addingChild} onOpenChange={setAddingChild}
        onSuccess={() => { setAddingChild(false); router.refresh(); }} />
      <FamilyActivationEditChildBirthOverlay open={editingChild != null}
        onOpenChange={(open) => { if (!open) setEditingChild(null); }}
        child={editingChild ? { id: editingChild.id, name: editingChild.name ?? "" } : null}
        onSuccess={() => { setEditingChild(null); router.refresh(); }} />
    </>}
  </CityHomeSection>;
}
