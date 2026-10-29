"use client";

import { Zap } from "lucide-react";
import { StoryRingItem } from "./StoryRingItem";
import { StoryModal } from "./StoryModal";
import { useStoryViewer } from "../hooks/useStoryViewer";
import { resolveStoryRingCoverUrl } from "../lib/resolveStoryRingCoverUrl";
import type { StoryCollection } from "../types/story";
import { unseenCount } from "../lib/seen";

interface StoryRingsProps {
  stories: StoryCollection[];
}

export function StoryRings({ stories }: StoryRingsProps) {
  const {
    isOpen,
    newsComplete,
    continueAfterNews,
    activeStory,
    activeStoryIndex,
    activeItemIndex,
    seenIds,
    seenGroupStart,
    progressKey,
    paused,
    open,
    close,
    next,
    prev,
    pause,
    resume,
    markSeen,
  } = useStoryViewer(stories);

  return (
    <>
      {stories.map((story, index) => {
        const newCount = unseenCount(story.items, seenIds);
        return <StoryRingItem
          key={story.id}
          title={story.title}
          seen={newCount === 0}
          unseenCount={newCount}
          coverImageUrl={resolveStoryRingCoverUrl(story, seenIds)}
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
      })}

      {isOpen && newsComplete && activeStory?.intent === "breaking_news" && (
        <div role="dialog" aria-modal="true" aria-label="Новости просмотрены" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 text-center text-foreground">
            <h2 className="font-heading text-2xl">Вы посмотрели все новости</h2>
            <button type="button" onClick={continueAfterNews} className="min-h-11 w-full rounded-full bg-primary px-5 font-semibold text-primary-foreground">Смотреть дальше</button>
            <button type="button" onClick={close} className="min-h-11 w-full rounded-full border border-border px-5 font-semibold">Закрыть</button>
          </div>
        </div>
      )}
      {isOpen && !newsComplete && activeStory && activeStoryIndex !== null && (
        <StoryModal
          activeStory={activeStory}
          activeStoryIndex={activeStoryIndex}
          activeItemIndex={activeItemIndex}
          totalStories={stories.length}
          progressKey={progressKey}
          paused={paused}
          seenOfferIds={seenIds}
          seenGroupStart={seenGroupStart}
          onNext={next}
          onPrev={prev}
          onClose={close}
          onPause={pause}
          onResume={resume}
          onItemShown={markSeen}
        />
      )}
    </>
  );
}
