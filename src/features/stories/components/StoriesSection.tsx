"use client";

import { StoryRings } from "./StoryRings";
import { MOCK_STORIES } from "../data/stories.mock";
// TODO: replace MOCK_STORIES with server-fetched data when ranking engine is ready

export function StoriesSection() {
  return (
    <section aria-label="Stories">
      <StoryRings stories={MOCK_STORIES} />
    </section>
  );
}
