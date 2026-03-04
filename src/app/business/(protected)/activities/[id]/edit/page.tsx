"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Surface } from "@/components/ui/surface";
import { H1 } from "@/components/ui/typography";
import { ActivityForm, type ActivityFormData } from "@/features/activity/forms/ActivityForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditActivityPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [activity, setActivity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  const loadData = async () => {
    try {
      // Load cities
      const citiesRes = await fetch("/api/admin/taxonomy/cities");
      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(citiesData.cities || []);
      }

      // Load activity
      const activityRes = await fetch(`/api/business/activities/${resolvedParams.id}`);
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activity);
      } else {
        router.push("/activities");
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      router.push("/activities");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: ActivityFormData) => {
    const res = await fetch(`/api/business/activities/${resolvedParams.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update activity");
    }

    router.push("/activities");
  };

  const handleCancel = () => {
    router.push("/activities");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <Container className="max-w-3xl">
          <p className="text-center text-muted-foreground">Загрузка...</p>
        </Container>
      </div>
    );
  }

  if (!activity) {
    return null;
  }

  const initialData: Partial<ActivityFormData> = {
    name: activity.name,
    description: activity.description || "",
    cityId: activity.cityId || cities[0]?.id,
    coverImageUrl: activity.coverImageUrl || "",
    priceFrom: activity.priceFrom,
    currency: activity.currency || "BYN",
    ageLabel: activity.ageLabel || "",
    sessions: activity.sessions.map((s: any) => new Date(s.startsAt)),
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-3xl">
        <div className="space-y-6">
          <H1>Редактировать мероприятие</H1>

          <Surface className="p-6">
            <ActivityForm
              initialData={initialData}
              cities={cities}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Сохранить"
            />
          </Surface>
        </div>
      </Container>
    </div>
  );
}
