export type StoryIntent =
  | "today"
  | "weekend"
  | "free"
  | "near"
  | "age_3_5"
  | "new";

export type StoryItem = {
  id: string;
  title: string;
  image: string;
  age?: string;
  location?: string;
  datetime?: string;
  price?: string;
  businessName?: string;
  businessLogo?: string;
  isPromoted?: boolean;
  href?: string;
};

export type StoryCollection = {
  id: string;
  intent: StoryIntent;
  title: string;
  /** Emoji or icon name shown in the ring */
  emoji?: string;
  items: StoryItem[];
};
