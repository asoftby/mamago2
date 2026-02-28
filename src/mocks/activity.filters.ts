import { ActivityMock } from "./activity.types";

export interface FeedFilters {
  tags?: string[];
  // Future: age, price, etc.
}

export function applyFeedFilters(activities: ActivityMock[], filters: FeedFilters): ActivityMock[] {
  let filtered = [...activities];

  // Tags filter (AND logic - item must have ALL selected tags? OR logic is usually better for UI chips)
  // Let's use OR logic for chips (e.g. "Today" OR "Weekend") but usually users select one main intent.
  // User prompt said "multi-select", so let's assume OR logic if multiple selected? 
  // Actually, usually tags like "Free" AND "Today" might be AND.
  // Let's implement AND for now as it's stricter. If I select "Today" and "Free", I want free things today.
  
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(activity => 
      filters.tags!.every(tag => activity.tags.includes(tag))
    );
  }

  return filtered;
}

export function rankFeed(activities: ActivityMock[]): ActivityMock[] {
  // Simple ranking: prioritize with badge, then rating, then reviews
  return activities.sort((a, b) => {
    // 1. Has badge?
    if (a.badge && !b.badge) return -1;
    if (!a.badge && b.badge) return 1;
    
    // 2. Rating
    if (b.rating !== a.rating) return b.rating - a.rating;
    
    // 3. Reviews
    return b.reviewsCount - a.reviewsCount;
  });
}
