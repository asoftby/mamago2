"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ChildCard } from "@/components/children/ChildCard";
import { AddChildModal } from "@/components/children/AddChildModal";

// Mock data for testing
const mockChildren = [
  {
    id: "1",
    name: "Анна",
    birthDate: new Date("2018-03-15"),
    systemInterests: [
      { interestSlug: "sport" },
      { interestSlug: "music" },
      { interestSlug: "art" },
    ],
    customInterests: [
      { label: "динозавры" },
      { label: "космос" },
    ],
  },
  {
    id: "2", 
    name: "Максим",
    birthDate: new Date("2020-07-22"),
    systemInterests: [
      { interestSlug: "construction" },
      { interestSlug: "technology" },
    ],
    customInterests: [
      { label: "роботы" },
    ],
  },
];

export function ChildrenSystemSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMockData, setShowMockData] = useState(false);

  return (
    <section id="children" className="space-y-6 py-8 border-b border-border/40">
      <div>
        <H2>Children Management System</H2>
        <BodyMuted>
          Test the new children management UX with modal/sheet interface and interests system.
        </BodyMuted>
      </div>

      <div className="flex gap-4">
        <Button
          onClick={() => setShowMockData(!showMockData)}
          variant="outline"
        >
          {showMockData ? "Hide Mock Data" : "Show Mock Data"}
        </Button>
        <Button onClick={() => setIsModalOpen(true)}>
          Test Add Child Modal
        </Button>
      </div>

      {/* Empty State */}
      {!showMockData && (
        <Surface variant="elevated" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <H2>Моя семья</H2>
          </div>
          <div className="text-center py-8">
            <BodyMuted className="mb-4 max-w-md mx-auto">
              Добавьте ребёнка, чтобы мы могли точнее подбирать события, маршруты и занятия.
            </BodyMuted>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить ребёнка
            </Button>
          </div>
        </Surface>
      )}

      {/* With Children */}
      {showMockData && (
        <Surface variant="elevated" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <H2>Моя семья</H2>
            <Button
              onClick={() => setIsModalOpen(true)}
              size="sm"
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить ещё
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mockChildren.map((child) => (
              <ChildCard 
                key={child.id} 
                child={child} 
                onClick={() => console.log("Edit child:", child.name)}
              />
            ))}
          </div>
        </Surface>
      )}

      <AddChildModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}