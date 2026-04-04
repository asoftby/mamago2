"use client";

import { StoryRingItem } from "./StoryRingItem";
import { StoryModal } from "./StoryModal";
import { useStoryViewer } from "../hooks/useStoryViewer";
import type { StoryCollection } from "../types/story";

interface StoryRingsProps {
  stories: StoryCollection[];
}

export function StoryRings({ stories }: StoryRingsProps) {
  const {
    isOpen,
    activeStory,
    activeStoryIndex,
    activeItemIndex,
    seenIds,
    progressKey,
    paused,
    open,
    close,
    next,
    prev,
    pause,
    resume,
  } = useStoryViewer(stories);

  return (
    <>
      {/* Rings row */}
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar px-1 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {stories.map((story, index) => (
          <StoryRingItem
            key={story.id}
            title={story.title}
            emoji={story.emoji}
            seen={seenIds.has(story.id)}
            onClick={() => open(index)}
          />
        ))}
      </div>

      {/* Modal viewer */}
      {isOpen && activeStory && activeStoryIndex !== null && (
        <StoryModal
          activeStory={activeStory}
          activeStoryIndex={activeStoryIndex}
          activeItemIndex={activeItemIndex}
          totalStories={stories.length}
          progressKey={progressKey}
          paused={paused}
          onNext={next}
          onPrev={prev}
          onClose={close}
          onPause={pause}
          onResume={resume}
        />
      )}
    </>
  );
}
