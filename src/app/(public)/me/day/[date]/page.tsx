import { redirect } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import { Container } from "@/components/ui/Container";
import { Surface } from "@/components/ui/surface";
import { H1, Body } from "@/components/ui/typography";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type PageProps = {
  params: Promise<{ date: string }>;
};

export default async function DayScenarioPage({ params }: PageProps) {
  const resolvedParams = await params;
  
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(resolvedParams.date)) {
    redirect("/me/plan");
  }

  // Load plan items for this date
  const planItems = await listPlanItemsByDate(user.id, resolvedParams.date);

  // Sort by startsAt if available, otherwise by creation time
  const sortedItems = [...planItems].sort((a, b) => {
    if (a.startsAt && b.startsAt) {
      return a.startsAt.getTime() - b.startsAt.getTime();
    }
    if (a.startsAt) return -1;
    if (b.startsAt) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Format date for display
  const date = new Date(resolvedParams.date);
  const dateLabel = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  const formatTime = (dateTime: Date) => {
    return dateTime.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <Link
              href="/me/plan"
              className="text-sm text-primary hover:underline mb-2 inline-block"
            >
              ← Вернуться к плану
            </Link>
            <H1 className="capitalize">Сценарий на {dateLabel}</H1>
          </div>

          {/* Scenario Items */}
          {sortedItems.length > 0 ? (
            <div className="space-y-4">
              {sortedItems.map((item, index) => (
                <Surface key={item.id} className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Number badge */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Body className="font-medium text-lg">
                            Activity ID: {item.activityId}
                          </Body>
                          {item.startsAt && (
                            <Body className="text-muted-foreground text-sm mt-1">
                              Время: {formatTime(item.startsAt)}
                            </Body>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            /* Empty State */
            <Surface className="p-12">
              <div className="text-center space-y-4">
                <Body className="text-muted-foreground text-lg">
                  На этот день ничего не запланировано
                </Body>
                <Link href="/minsk">
                  <PrimaryButton>Найти мероприятия</PrimaryButton>
                </Link>
              </div>
            </Surface>
          )}
        </div>
      </Container>
    </div>
  );
}
