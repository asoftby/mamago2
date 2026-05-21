"use client";

import { Zap } from "lucide-react";
import { StoryRingItem } from "./StoryRingItem";
import { StoryModal } from "./StoryModal";
import { useStoryViewer } from "../hooks/useStoryViewer";
import { resolveStoryRingCoverUrl } from "../lib/resolveStoryRingCoverUrl";
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
      {stories.map((story, index) => (
        <StoryRingItem
          key={story.id}
          title={story.title}
          seen={seenIds.has(story.id)}
          coverImageUrl={resolveStoryRingCoverUrl(story)}
          itemCount={story.items.length}
          imagePriority={index === 0}
          fallbackContent={
            story.intent === "breaking_news" ? (
              <div
                className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE]"
                aria-hidden
              >
                <Zap className="h-8 w-8 text-[#2563EB] md:h-10 md:w-10" strokeWidth={1.75} />
              </div>
            ) : undefined
          }
          onClick={() => open(index)}
        />
      ))}

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
