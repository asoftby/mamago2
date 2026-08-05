export type StoryIntent =
  | "breaking_news"
  | "today"
  | "tomorrow"
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
  /** Persisted identity for seen-state. Never use an occurrence/session id here. */
  offerId: string;
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
};
