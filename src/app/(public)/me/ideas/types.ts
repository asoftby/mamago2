export type IdeaItem = {
  id: string;
  activity: {
    id: string;
    title: string;
    type: "EVENT" | "PLACE" | "ROUTE" | "OFFER";
    coverImageUrl?: string;
    city?: string;
    ageRange?: string;
    dateStart?: string;
    dateEnd?: string;
  };
  isPlanned: boolean;
  plannedDate?: string;
  createdAt: string;
};

export type Filter = "ALL" | "PLANNED" | "UNPLANNED";
