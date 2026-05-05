"use client";

import { Container } from "@/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { H1, H2, H3, Body, Caption } from "@/components/ui/typography";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { WhenSelect } from "@/components/ui/when-select";

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

      </Container>
    </main>
  );
}
