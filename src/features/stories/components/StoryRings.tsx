"use client";

import { Zap } from "lucide-react";
import { useEffect } from "react";
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
    orderedStories,
    sessionStories,
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

  const isFinalStory = activeStoryIndex === sessionStories.length - 1;
  const nextStory = activeStoryIndex !== null ? sessionStories[activeStoryIndex + 1] : null;

  useEffect(() => {
    if (!newsComplete || !nextStory) return;
    const timeout = window.setTimeout(continueAfterNews, 1400);
    return () => window.clearTimeout(timeout);
  }, [newsComplete, nextStory, continueAfterNews]);

  return (
    <>
      {orderedStories.map((story, index) => {
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

      {isOpen && newsComplete && activeStory && (
        <div role="dialog" aria-modal="true" aria-label={isFinalStory ? "Все новости просмотрены" : "Следующая тема"} className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/85 px-6 text-center text-white">
          {isFinalStory ? (
            <>
              <h2 className="font-heading text-2xl">Вы просмотрели все новости</h2>
              <button type="button" onClick={close} className="absolute bottom-[max(32px,env(safe-area-inset-bottom))] left-6 right-6 mx-auto min-h-12 max-w-sm rounded-full bg-white px-5 font-semibold text-black">Закрыть</button>
            </>
          ) : (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm text-white/60">Вы просмотрели {activeStory.title}</p>
              <h2 className="font-heading text-2xl">Далее — {nextStory?.title}</h2>
            </div>
          )}
        </div>
      )}
      {isOpen && !newsComplete && activeStory && activeStoryIndex !== null && (
        <StoryModal
          activeStory={activeStory}
          activeStoryIndex={activeStoryIndex}
          activeItemIndex={activeItemIndex}
          totalStories={sessionStories.length}
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
