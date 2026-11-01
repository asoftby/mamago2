"use client";

import { useParams } from "next/navigation";
import { IdeasCollections } from "@/features/ideas-collections/IdeasCollections";
import type { IdeaItem } from "./types";
import type { CollectionMemberships, CollectionSummary } from "./collectionState";

interface Props {
  initialIdeas: IdeaItem[];
  initialCollections?: CollectionSummary[];
  initialMemberships?: CollectionMemberships;
  discoveryHref?: string;
}

/** Страница /me/ideas и /me/ideas/collections/[id] — коллекция из URL становится выбранным фильтром. */
export function IdeasClient({ initialIdeas, initialCollections = [], initialMemberships = {}, discoveryHref = "/minsk" }: Props) {
  const params = useParams<{ id?: string }>();
  return (
    <IdeasCollections
      layout="page"
      initialIdeas={initialIdeas}
      initialCollections={initialCollections}
      initialMemberships={initialMemberships}
      initialCollectionId={params?.id ?? null}
      discoveryHref={discoveryHref}
    />
  );
}
