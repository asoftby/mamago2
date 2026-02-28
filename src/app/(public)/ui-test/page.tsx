"use client";

import { Container } from "@/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { H1, H2, H3, Body, Caption } from "@/components/ui/typography";
import { UiActivityCard } from "@/components/ui/activity-card";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { WhenSelect } from "@/components/ui/when-select";

const MOCK_ACTIVITIES = [
  {
    id: "1",
    href: "/minsk/activity/1",
    title: "Kids Playroom — Летняя программа",
    imageUrl: "https://picsum.photos/seed/a1/800/600",
    meta: "4+ • сегодня • Бесплатно",
    badges: ["Новое"],
    rating: 4.7,
  },
  {
    id: "2",
    href: "/minsk/activity/2",
    title: "Музыкальная школа — Подготовка",
    imageUrl: "https://picsum.photos/seed/a2/800/600",
    meta: "6+ • Сегодня, 18:00 • от 20 BYN",
    rating: 4.6,
  },
  {
    id: "3",
    href: "/minsk/activity/3",
    title: "Семейное кафе — детская комната",
    imageUrl: "https://picsum.photos/seed/a3/800/600",
    meta: "0+ • До 22:00 • от 14 BYN",
    rating: 4.5,
  },
];

export default function UiTestPage() {
  return (
    <main className="min-h-screen bg-background">
      <Container className="py-8 space-y-8">
        <section className="space-y-2">
          <H1>Typography</H1>
          <div className="space-y-2">
            <H2>Заголовок H2</H2>
            <H3>Заголовок H3</H3>
            <Body>Текст Body</Body>
            <Caption>Подпись Caption</Caption>
          </div>
        </section>

        <section className="space-y-2">
          <H2>Buttons</H2>
          <Card>
            <CardHeader>
              <CardTitle>Варианты</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          <H2>Select v2.0</H2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <WhenSelect />
            <CardSelect label="Возраст" options={[{ value: "4", label: "4+" }]} value={null} onChange={() => {}} />
            <CardMultiSelect label="Метро" options={[{ value: "m1", label: "Площадь" }]} values={[]} onChange={() => {}} />
            <CardMultiSelect label="Район" options={[{ value: "d1", label: "Центр" }]} values={[]} onChange={() => {}} />
          </div>
        </section>

        <section className="space-y-2">
          <H2>ActivityCard (UI Kit)</H2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UiActivityCard
              href="/minsk/activity/test-1"
              title={MOCK_ACTIVITIES[0].title}
              imageUrl={MOCK_ACTIVITIES[0].imageUrl}
              badges={MOCK_ACTIVITIES[0].badges}
              meta={MOCK_ACTIVITIES[0].meta}
              rating={MOCK_ACTIVITIES[0].rating}
              topRight={<FavoriteButton />}
            />
            <UiActivityCard
              href="/minsk/activity/test-2"
              title="Секция без картинки"
              imageUrl={null}
              meta="6+ • Сегодня, 18:00 • от 20 BYN"
              topRight={<FavoriteButton />}
            />
            <UiActivityCard
              href="/minsk/activity/test-3"
              title="Очень длинный заголовок карточки для проверки обрезания текста и устойчивости сетки при разных размерах текста"
              imageUrl={MOCK_ACTIVITIES[2].imageUrl}
              meta="0+ • До 22:00 • от 14 BYN"
              topRight={<FavoriteButton />}
            />
          </div>
        </section>
      </Container>
    </main>
  );
}
