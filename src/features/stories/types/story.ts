export type StoryIntent =
  | "breaking_news"
  | "today"
  | "weekend"
  | "free"
  | "near"
  | "age_3_5"
  | "new";

export type StoryItemType =
  | "story"
  | "breaking-news"
  | "event"
  | "place"
  | "offer"
  | "route";

export type StoryItem = {
  id: string;
  title: string;
  image: string;
  type?: StoryItemType;
  subtitle?: string;
  eyebrow?: string;
  description?: string;
  age?: string;
  location?: string;
  datetime?: string;
  price?: string;
  businessName?: string;
  businessLogo?: string;
  isPromoted?: boolean;
  href?: string | null;
};

export type StoryCollection = {
  id: string;
  intent: StoryIntent;
  title: string;
  /** Emoji or icon name shown in the ring */
  emoji?: string;
  items: StoryItem[];
  /**
   * Precomputed cover URLs for the ring collage (up to 4).
   * If not set, resolveStoryRingCoverUrl falls back to items[0].image.
   */
  coverImageUrls?: string[];
};
