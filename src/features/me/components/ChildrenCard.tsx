"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddChildModal } from "@/components/children/AddChildModal";
import { ChildCard } from "@/components/children/ChildCard";

interface ChildData {
  id: string;
  name: string;
  birthDate: Date;
  systemInterests?: { interestSlug: string }[];
  customInterests?: { label: string }[];
}

type ChildrenCardProps = {
  children: ChildData[];
};

export function ChildrenCard({ children }: ChildrenCardProps) {
  console.log("ChildrenCard rendered with children:", children);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildData | undefined>(undefined);

  const handleAddChild = () => {
    setEditingChild(undefined);
    setIsModalOpen(true);
  };

  const handleEditChild = (child: ChildData) => {
    console.log("handleEditChild called with:", child);
    setEditingChild(child);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingChild(undefined);
  };

  return (
    <>
      <Surface variant="elevated" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <H2>Мои дети</H2>
          {children.length > 0 && (
            <Button
              onClick={handleAddChild}
              size="sm"
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить ребёнка
            </Button>
          )}
        </div>

        {children.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {children.map((child) => {
              console.log("Rendering child card:", child);
              return (
                <ChildCard 
                  key={child.id} 
                  child={child} 
                  onClick={() => handleEditChild(child)}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <BodyMuted className="mb-4 max-w-md mx-auto">
              Добавьте ребёнка, чтобы мы могли точнее подбирать события, маршруты и занятия.
            </BodyMuted>
            <Button
              onClick={handleAddChild}
              className="h-11 px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить ребёнка
            </Button>
          </div>
        )}
      </Surface>

      <AddChildModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        childData={editingChild}
      />
    </>
  );
}
