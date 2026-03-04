"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Surface } from "@/components/ui/surface";
import { H1 } from "@/components/ui/typography";
import { ActivityForm, type ActivityFormData } from "@/features/activity/forms/ActivityForm";

export default function NewActivityPage() {
  const router = useRouter();
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const res = await fetch("/api/admin/taxonomy/cities");
      if (res.ok) {
        const data = await res.json();
        setCities(data.cities || []);
      }
    } catch (error) {
      console.error("Failed to load cities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: ActivityFormData) => {
    const res = await fetch("/api/business/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create activity");
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

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-3xl">
        <div className="space-y-6">
          <H1>Создать мероприятие</H1>

          <Surface className="p-6">
            <ActivityForm
              cities={cities}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Создать"
            />
          </Surface>
        </div>
      </Container>
    </div>
  );
}
