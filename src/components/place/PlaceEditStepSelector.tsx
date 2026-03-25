"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  User, 
  MapPin, 
  Camera, 
  Phone, 
  Clock, 
  CheckCircle,
  Edit3
} from "lucide-react";

interface PlaceEditStepSelectorProps {
  placeId: string;
  className?: string;
}

const WIZARD_STEPS = [
  {
    step: 1,
    title: "Профиль",
    description: "Название, категория, описание",
    icon: User,
  },
  {
    step: 2,
    title: "Локация",
    description: "Адрес и местоположение",
    icon: MapPin,
  },
  {
    step: 3,
    title: "Фото",
    description: "Логотип и галерея",
    icon: Camera,
  },
  {
    step: 4,
    title: "Контакты",
    description: "Телефон, сайт, соцсети",
    icon: Phone,
  },
  {
    step: 5,
    title: "Режим работы",
    description: "Часы работы и расписание",
    icon: Clock,
  },
  {
    step: 6,
    title: "Проверка и отправка",
    description: "Финальная проверка изменений",
    icon: CheckCircle,
  },
];

export function PlaceEditStepSelector({ placeId, className }: PlaceEditStepSelectorProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleStepSelect = (step: number) => {
    setOpen(false);
    router.push(`/editor/place/${placeId}/edit?step=${step}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          className={className}
        >
          <Edit3 className="w-4 h-4 mr-2" />
          Редактировать
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать место</DialogTitle>
          <DialogDescription>
            Выберите раздел, который хотите изменить
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {WIZARD_STEPS.map((stepInfo) => {
            const Icon = stepInfo.icon;
            return (
              <button
                key={stepInfo.step}
                onClick={() => handleStepSelect(stepInfo.step)}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {stepInfo.title}
                  </div>
                  <div className="text-sm text-gray-500">
                    {stepInfo.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}